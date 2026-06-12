---
description: Pre-ship security audit workflow. Systematically checks for the most common and highest-impact vulnerabilities. Run before any change involving auth, user input, payments, or data access ships to production.
---

# Security Review Workflow

A structured security audit to catch vulnerabilities before they reach production.

## When to use
- Before shipping any change that handles user input
- Before any auth or authorization code change goes live
- Before payment or PII-handling code ships
- As a periodic audit (quarterly or before major releases)

---

## Workflow

### Step 1 — Identify the attack surface

List every place where this code receives external input:
- HTTP request body, query params, headers, cookies
- File uploads
- Webhook payloads from third parties
- Data read from the database that originally came from users
- URL path parameters

For each input source, note: Is it validated? By what mechanism?

### Step 2 — Authentication audit

Read every route, endpoint, or function that should require authentication:

- [ ] Auth check present before any data is accessed or modified
- [ ] Auth token/session is validated (signature checked, expiry checked) — not just decoded
- [ ] The validation happens on the server — client-supplied auth state is not trusted
- [ ] Logout invalidates the session server-side, not just client-side
- [ ] Failed auth attempts are rate-limited

Check specifically: can an unauthenticated request reach any protected resource by accident (e.g., a missing middleware in a route group)?

### Step 3 — Authorization audit

For every data access operation, verify:

- [ ] The requesting user's identity is checked against the resource's owner/permissions
- [ ] The check happens at the data layer (e.g., `WHERE user_id = $currentUserId`), not just at the route level
- [ ] Privilege escalation paths are checked: can a `user` role trigger an `admin` operation?
- [ ] Horizontal access control: can User A access User B's data by changing an ID?

Test: mentally walk through a request where `userId` in the payload differs from the authenticated user's ID. Does the system reject it?

### Step 4 — Injection audit

Check every place where external data is used to build a query, command, or output:

**SQL injection**
```bash
# Search for potential SQL injection patterns
grep -r "query\|execute\|raw(" src/ --include="*.ts" | grep -v "\.test\."
```
Every query must use parameterized statements or an ORM. Flag any string interpolation.

**XSS**
```bash
grep -r "dangerouslySetInnerHTML\|innerHTML\|v-html" src/ --include="*.tsx"
```
Every occurrence must be justified. User content must be sanitized before rendering.

**Command injection**
```bash
grep -r "exec\|spawn\|system\|shell" src/ --include="*.ts"
```
Any shell execution must use array argument form, not string interpolation.

**Path traversal**
Check file upload handlers and any code that reads files based on user-provided names. Use `path.basename()` and validate against an allowlist.

### Step 5 — Secrets audit

```bash
# Check for hardcoded secrets
grep -r "api_key\|apikey\|password\|secret\|token\|Bearer\s" src/ \
  --include="*.ts" --include="*.py" --include="*.go" \
  | grep -v "test\|spec\|example\|placeholder\|your_"
```

Check `.env.example` — it should have empty or example values only, never real secrets.

Verify `.gitignore` includes:
```
.env
.env.local
.env.production
*.pem
*.key
secrets/
```

### Step 6 — Error handling audit

Check every error handler and catch block:

- [ ] No stack traces returned to clients in production
- [ ] No internal file paths in error messages
- [ ] No database error details exposed to clients
- [ ] Error messages are useful to the user but not to an attacker

```typescript
// Bad — reveals stack trace and internal path
res.status(500).json({ error: error.stack })

// Good — generic message, logged internally
logger.error('Unexpected error', { error, userId: req.user?.id })
res.status(500).json({ error: 'An unexpected error occurred' })
```

### Step 7 — Dependency audit

```bash
npm audit                         # Node.js
pip-audit                         # Python
govulncheck ./...                 # Go
```

Flag any high/critical vulnerabilities. Note any packages that are outdated by more than 2 major versions.

### Step 8 — Transport and headers

For web applications, verify:

- [ ] All API endpoints are HTTPS-only in production
- [ ] CORS is configured to the minimum necessary origins (not `*` for authenticated APIs)
- [ ] Security headers are set:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`

### Step 9 — Rate limiting

Check that rate limiting is configured on:
- [ ] Login endpoint
- [ ] Signup / account creation
- [ ] Password reset / magic link send
- [ ] Any endpoint that triggers an email or SMS
- [ ] Any expensive computation endpoint

---

## Output

After completing the audit, produce a findings report:

```
## Security Review — [date]

### Scope
Files and components reviewed.

### Findings

**[CRITICAL/HIGH/MEDIUM/LOW]** path/to/file.ts:42 — [Vulnerability type]
Description, impact, and specific remediation.

### Verified Clean
What was checked and found to be correctly implemented.

### Deferred
Issues acknowledged but not blocking current ship, with rationale.
```

All Critical and High findings must be resolved before shipping.
