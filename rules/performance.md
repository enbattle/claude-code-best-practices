# Performance Rules

## Principle: Measure Before You Optimize

Never optimize based on intuition. Premature optimization is code that's harder to read and maintain for a gain you haven't confirmed. Profile first, then optimize the actual bottleneck.

**The workflow:**
1. Establish a baseline measurement (latency, throughput, memory)
2. Identify the actual bottleneck with profiling tools
3. Optimize the bottleneck
4. Measure again to confirm the improvement
5. Commit only if the improvement is real and meaningful

---

## Database Performance

### Query patterns

**Use `SELECT <columns>` not `SELECT *`**
Especially for large tables — fetching unused columns wastes bandwidth and memory.

**Avoid N+1 queries**
N+1 is the most common DB performance bug: fetching a list, then fetching related data for each item in a loop.

```typescript
// N+1: 1 query for orders + 1 per order for user = 101 queries for 100 orders
const orders = await db.order.findMany()
for (const order of orders) {
  const user = await db.user.findUnique({ where: { id: order.userId } })
}

// Good: 1 query with include = 1 query total
const orders = await db.order.findMany({
  include: { user: true }
})
```

**Paginate list queries**
Never return unbounded result sets. Always apply `LIMIT` and `OFFSET` (or cursor pagination for large datasets).

**Index your queries**
Columns used in `WHERE`, `JOIN ON`, `ORDER BY`, and foreign keys should be indexed. Unindexed queries cause full table scans that degrade as data grows.

```sql
-- Add indexes for common query patterns
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);  -- composite
```

**Use transactions for multi-step writes**
Wrapping related writes in a transaction prevents partial updates and improves throughput by reducing round trips.

### Connection pooling
Always use a connection pool in production. Configure pool size based on your database server's `max_connections`:

- PostgreSQL typical: `max_connections=100` on a small instance
- Application pool size: `(2 × CPU cores) + spindle count` — usually 10–25
- Never create a new DB connection per request

---

## Caching

### What to cache
- Expensive, frequently-read data that changes infrequently (user profiles, product catalog, config)
- Results of external API calls
- Computed/aggregated values that are expensive to recompute

### What not to cache
- Write-heavy data (cache invalidation becomes the problem)
- Data that must be strongly consistent (account balances, inventory counts)
- Data with many unique keys that'll never be reused (cache pollution)

### Cache invalidation
- Set TTLs — never cache indefinitely unless you have explicit invalidation logic
- Invalidate on write: when data changes, invalidate the corresponding cache key
- Use cache-aside pattern: read from cache, fall back to DB on miss, write to cache after DB read

### Cache levels
| Level | Tool | Use case |
|---|---|---|
| In-process | LRU cache, memoization | Single-instance, CPU-bound results |
| Distributed | Redis, Memcached | Shared across instances, session data |
| HTTP | CDN, `Cache-Control` headers | Static assets, public API responses |
| DB query cache | PostgreSQL query plan cache | Automatically managed |

---

## API & Network Performance

### HTTP caching
Use `Cache-Control` headers for public resources:
```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

For API responses that vary by user, use `Cache-Control: private, no-cache`.

### Parallel requests
Make independent I/O operations concurrently — don't await them sequentially.

```typescript
// Sequential (bad): total time = request1 time + request2 time
const user = await fetchUser(id)
const settings = await fetchSettings(id)

// Parallel (good): total time = max(request1 time, request2 time)
const [user, settings] = await Promise.all([
  fetchUser(id),
  fetchSettings(id),
])
```

### Response payload size
- Return only the fields the client needs
- Use pagination — don't return 10,000 records at once
- Compress responses with gzip/brotli
- Use JSON field selection (`fields=id,name,email`) for large resources if clients need different subsets

---

## Frontend Performance

### Bundle size
- Audit with `bundlephobia` before adding new dependencies
- Tree-shake: use named imports, not default imports of entire libraries
- Code-split at route boundaries — load only what the current page needs
- Lazy-load below-the-fold components

```typescript
// Lazy load heavy components
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  loading: () => <Skeleton />,
  ssr: false,
})
```

### Rendering
- Profile with React DevTools before adding `memo`, `useMemo`, or `useCallback`
- `useCallback` without a dependency array doesn't help — it still recreates on every render
- Virtualize long lists (100+ items) — render only what's visible (`tanstack/virtual`, `FlashList`)
- Avoid layout thrash: batch DOM reads and writes, don't interleave them

### Images
- Serve in modern formats (WebP, AVIF) with fallbacks
- Specify `width` and `height` to prevent layout shift (CLS)
- Use lazy loading for below-the-fold images (`loading="lazy"`)
- Use a CDN with image optimization (`next/image` handles this automatically)

---

## Memory Management

### Leaks to watch for
- Event listeners added in `useEffect` without cleanup
- Intervals/timers not cleared on component unmount
- Subscriptions not unsubscribed
- Closures holding large objects in scope unnecessarily

```typescript
useEffect(() => {
  const subscription = eventBus.subscribe('update', handleUpdate)
  return () => subscription.unsubscribe()  // cleanup is required
}, [])
```

### Node.js / server-side
- Stream large files — don't buffer them entirely in memory
- Use streaming responses for large datasets
- Watch for unbounded arrays or maps that grow with each request

---

## Performance Budget

Set and enforce measurable targets:

| Metric | Target |
|---|---|
| API p95 latency | < 200ms |
| API p99 latency | < 500ms |
| Page initial load (LCP) | < 2.5s |
| Time to interactive | < 3.5s |
| Core Web Vitals | All green |
| Bundle size (JS, gzipped) | < 150kb initial |

Track these in CI with performance budgets. A deploy that regresses p95 latency by 50ms should require explicit sign-off.
