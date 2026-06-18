# Database Rules

Database mistakes are uniquely dangerous: they can lose data permanently, take down a production service, or cause hours of downtime. Unlike application bugs, bad migrations can't always be undone. These rules encode the patterns used at companies where databases must stay live and data must stay intact.

---

## Migration Safety

### Every schema change must be a migration file

No ad-hoc DDL in production. No "just run this SQL in the console." Every schema change is:
1. Written as a migration file
2. Committed to version control
3. Run through CI against a test database
4. Applied in staging before production

### Migrations must be reversible

Every migration file must have a `down` function (rollback). Before merging, verify that the down migration actually works — run it against the same test database.

```typescript
// Good — both up and down defined and tested
export async function up(db) {
  await db.schema.table('users', t => {
    t.string('phone_number').nullable()
  })
}

export async function down(db) {
  await db.schema.table('users', t => {
    t.dropColumn('phone_number')
  })
}
```

### Test migrations up and down

```bash
# In CI, run the migration and then roll it back
knex migrate:latest
knex migrate:rollback
knex migrate:latest  # should work identically the second time
```

If rollback fails or leaves the schema in a broken state, the migration is not merge-ready.

---

## Zero-Downtime Migrations — The Expand-Contract Pattern

The most critical database rule: never make a change that requires the application to be taken down.

The root problem: your old application code and new application code run simultaneously during a rolling deployment. If the schema requires the new code, the old code breaks. If the schema requires the old code, the new code breaks.

The solution is the **expand-contract** pattern. Every breaking schema change takes three deployments instead of one.

### Phase 1 — Expand (backward compatible)

Make the schema change additive only. The old code continues to work; new code can optionally use the new structure.

```sql
-- Add the new column as nullable
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL;
```

Deploy application code that writes to BOTH the old and new column.

### Phase 2 — Migrate existing data

```sql
-- Backfill the new column (in batches — see below)
UPDATE users SET phone_number = phone FROM user_phones WHERE user_phones.user_id = users.id;
```

Deploy application code that reads from the new column.

### Phase 3 — Contract (remove old structure)

Only after all application instances are on the new code and the old structure is no longer needed.

```sql
-- Safe to drop now
ALTER TABLE user_phones DROP CONSTRAINT ...; -- or DROP TABLE
```

### Never do this in a single migration

```sql
-- This takes a lock and breaks the app during deployment
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

Renaming a column in a single step breaks any running application that uses the old name. Always expand (add new) → migrate -> contract (remove old).

---

## Lock Safety

### Long-running migrations take table locks

Most DDL in PostgreSQL takes an `ACCESS EXCLUSIVE` lock, which blocks all reads and writes. On a large table, this means downtime.

### Use CONCURRENTLY for index creation

```sql
-- Bad — blocks all reads and writes while the index is built
CREATE INDEX idx_users_email ON users(email);

-- Good — runs in background, no lock
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

`CREATE INDEX CONCURRENTLY` takes longer but doesn't block traffic. Always use it for tables with significant traffic.

### Set lock timeout before any DDL

```sql
-- Fail fast if you can't get the lock in 5 seconds, rather than blocking
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN bio TEXT;
```

Without a lock timeout, a DDL statement can wait indefinitely for a lock, queuing up all subsequent queries behind it. Setting `lock_timeout` means the migration fails fast rather than causing a pile-up.

### Patterns that require table rewrites (avoid on large tables)

These operations rebuild the entire table and hold locks for the duration:
- Adding a `NOT NULL` column without a default
- Changing a column's type in a way that requires rewriting values
- Adding a `CHECK` constraint (use `NOT VALID` + `VALIDATE CONSTRAINT` instead)

For large tables, use the expand-contract pattern instead of any of these.

---

## Large Table Migrations

When a table has millions of rows, don't run a single `UPDATE` that modifies every row. It will:
- Lock rows for the duration of the transaction
- Generate enormous WAL/binlog volume
- Potentially cause replication lag on replicas
- Time out or be killed before completion

### Batch large backfills

```typescript
// Process in batches, with delays between batches
const BATCH_SIZE = 1000
let lastId = 0

while (true) {
  const result = await db.raw(`
    UPDATE users
    SET display_name = first_name || ' ' || last_name
    WHERE id > ? AND display_name IS NULL
    ORDER BY id
    LIMIT ?
  `, [lastId, BATCH_SIZE])

  if (result.rowCount === 0) break

  const [{ max_id }] = await db.raw('SELECT MAX(id) as max_id FROM users WHERE id > ? LIMIT ?', [lastId, BATCH_SIZE])
  lastId = max_id

  await sleep(100) // brief pause to reduce replication lag
}
```

For very large tables (100M+ rows), consider running backfills as background jobs over days rather than during deployment.

---

## Query Performance

### Explain before you optimize

Never guess about query performance. Use `EXPLAIN ANALYZE` (PostgreSQL) or `EXPLAIN` (MySQL) to see the actual execution plan.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';
```

Look for: `Seq Scan` on large tables (missing index), high `rows removed by filter` (wrong index), `Nested Loop` on large datasets (N+1).

### Index rules

- Every foreign key must be indexed (no exceptions — unindexed FKs cause full table scans on joins)
- Every column used in a `WHERE`, `JOIN`, or `ORDER BY` on a large table needs an index
- Composite indexes: column order matters — put the highest-cardinality column or most-filtered column first
- Don't index every column — unused indexes slow down writes without helping reads

### The N+1 query problem

N+1 happens when you execute one query to get a list, then one query per item in the list to fetch related data.

```typescript
// Bad — 1 query for orders + N queries for users (one per order)
const orders = await db.order.findMany()
for (const order of orders) {
  order.user = await db.user.findUnique({ where: { id: order.userId } })
}

// Good — 2 queries total regardless of how many orders exist
const orders = await db.order.findMany({
  include: { user: true }  // Prisma generates a JOIN or batched query
})
```

### Avoid SELECT *

Always specify the columns you need. `SELECT *` forces the database to return every column including potentially large TEXT or JSON fields, hurting both query performance and network bandwidth.

```sql
-- Bad
SELECT * FROM users WHERE id = 123;

-- Good
SELECT id, email, name, created_at FROM users WHERE id = 123;
```

---

## Connection Pooling

Direct database connections are expensive — each one holds server resources. Applications must use a connection pool.

### Configure pool size correctly

The optimal pool size is not "as large as possible." Each connection uses server RAM and CPU. Saturating the database with connections degrades performance for everyone.

A useful formula for PostgreSQL: `pool_size = num_cores * 2 + 1` as a starting point, adjusted by load testing.

```typescript
const db = new Pool({
  max: 10,              // maximum connections in pool
  min: 2,               // keep at least 2 alive
  idleTimeoutMillis: 30_000,  // close idle connections after 30s
  connectionTimeoutMillis: 2_000,  // fail if no connection available in 2s
})
```

### PgBouncer / connection proxies for serverless

Serverless functions create a new connection per invocation. Without a connection proxy, this can overwhelm your database.

For serverless (Lambda, Vercel, Cloudflare Workers): always put a connection pooler (PgBouncer, RDS Proxy, Supabase pooler) in front of your database.

---

## Data Integrity

### Use database constraints, not just application validation

Application validation can be bypassed (direct DB access, migrations, bugs). Enforce invariants at the database level.

```sql
-- Not null where the field is required
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Unique constraint for uniqueness invariants
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Check constraint for valid state
ALTER TABLE orders ADD CONSTRAINT orders_amount_positive CHECK (amount > 0);

-- Foreign key constraints for referential integrity
ALTER TABLE orders ADD CONSTRAINT orders_user_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

If a constraint exists only in application code, it will eventually be violated.

### Use transactions for multi-step operations

Any operation that modifies multiple rows or tables as a logical unit must be wrapped in a transaction. If one step fails, the entire operation rolls back.

```typescript
await db.transaction(async (trx) => {
  await trx('accounts').where({ id: fromId }).decrement('balance', amount)
  await trx('accounts').where({ id: toId }).increment('balance', amount)
  await trx('transactions').insert({ fromId, toId, amount, createdAt: new Date() })
  // if any of these fail, all three are rolled back
})
```

---

## Backup and Recovery

### The backup rule: you have no backup until you've restored from it

Test restores on a schedule. A backup that you've never restored from might be corrupted, incomplete, or point to the wrong files. The time to discover this is not during an incident.

### Minimum backup requirements

- Automated backups on a schedule (daily minimum, hourly for critical data)
- Point-in-time recovery enabled (PostgreSQL WAL archiving, MySQL binlog)
- Backups stored in a separate account/region from the primary database
- Restore tested quarterly — time the restore and verify data integrity
- Retention: 7 days minimum, 30 days for production

### Document your RTO and RPO

- **RTO (Recovery Time Objective):** how long can the system be down? If 4 hours, your restore procedure must complete in under 4 hours.
- **RPO (Recovery Point Objective):** how much data can be lost? If 1 hour, backups must run at least hourly.

If you don't know your RTO/RPO, you don't know if your backup strategy is adequate.
