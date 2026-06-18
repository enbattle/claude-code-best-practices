# Observability Rules

Observability is how you know what your system is doing after it ships. Without it, production debugging is guesswork. At every major tech company, structured logging, tracing, and metrics are treated as foundational requirements — not optional polish added later.

The three pillars: **logs** (what happened), **traces** (how a request moved through the system), **metrics** (how the system is performing over time).

---

## Structured Logging

### Always log as structured data (JSON), never free-form strings

```typescript
// Bad — unstructured, unsearchable
console.log(`User ${userId} logged in from ${ip} at ${new Date()}`)

// Good — structured, queryable, alertable
logger.info('user.login', {
  userId,
  ip,
  userAgent: req.headers['user-agent'],
  durationMs: Date.now() - startTime,
})
```

Every log line must be parseable by your log aggregator (Datadog, CloudWatch, Loki, etc.). Free-form strings cannot be queried, alerted on, or aggregated.

### Required fields on every log line

| Field | Type | Purpose |
|---|---|---|
| `timestamp` | ISO 8601 UTC | When it happened |
| `level` | string | Severity (see below) |
| `service` | string | Which service emitted this |
| `requestId` | string | Correlate logs across a single request |
| `message` | string | Human-readable event name |

**Add when available:**
- `userId` — who triggered the action (never PII — use an ID, not an email)
- `durationMs` — how long the operation took
- `traceId` / `spanId` — for distributed tracing correlation

### Log levels — use the right one

| Level | When to use | Example |
|---|---|---|
| `DEBUG` | Detailed internal state, disabled in production | Variable values during computation |
| `INFO` | Normal significant events | Request received, user authenticated, job started |
| `WARN` | Unexpected but handled — investigate if frequent | Retry succeeded after failure, deprecated API used |
| `ERROR` | Something failed and needs attention | Payment failed, DB query timeout, unhandled exception |
| `FATAL` | Service cannot continue | Cannot connect to DB at startup |

`ERROR` should always create an alert or ticket. `WARN` should be reviewed in weekly ops checks. Never use `ERROR` for expected failure states (invalid user input is not an error — it's a 400).

### What NOT to log

- **Passwords, tokens, API keys** — ever, at any log level
- **Full credit card numbers, SSNs, government IDs** — store last 4 digits only
- **PII beyond what's necessary** — log `userId` not `email`; log `countryCode` not full address
- **Full request/response bodies** — they often contain secrets or PII; log sanitized summaries instead
- **Health check endpoints** — they create noise with no signal; suppress them

---

## Request Tracing

### Assign a unique request ID to every inbound request

Generate at the API gateway or first service layer. Propagate it through every downstream call via HTTP headers.

```typescript
// Middleware: assign and propagate
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] ?? crypto.randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
})
```

Every log line emitted during that request must include `requestId`. This makes it possible to reconstruct the full history of a single request across hundreds of log lines and multiple services.

### Distributed tracing for multi-service architectures

If your system has more than one service, use OpenTelemetry for distributed tracing. It propagates trace context across service boundaries so you can see the full call graph for a single user request.

```typescript
// Propagate trace context in outbound HTTP calls
const tracer = trace.getTracer('my-service')
const span = tracer.startSpan('downstream.call')
context.with(trace.setSpan(context.active(), span), async () => {
  await httpClient.get('/downstream/endpoint')
  span.end()
})
```

**Minimum to instrument:** every external HTTP call, every database query, every message queue publish/consume.

---

## Metrics

### The RED method for services

For every service and every endpoint, track:
- **Rate** — requests per second
- **Errors** — error rate (errors / total requests)
- **Duration** — p50, p95, p99 latency

These three metrics answer the most common production question: "is this working?"

### The USE method for infrastructure

For every infrastructure resource (CPU, memory, DB connections, queue depth):
- **Utilization** — what percentage of capacity is in use
- **Saturation** — is anything waiting because of resource limits
- **Errors** — are there errors at the infrastructure level

### Metrics to track at minimum

```
http_requests_total{method, path, status_code}    # Request rate + error rate
http_request_duration_seconds{method, path}       # Latency histogram
db_query_duration_seconds{query_name}             # DB performance
db_pool_connections{state: active|idle|waiting}   # Connection pool health
queue_depth{queue_name}                           # Work backlog
cache_hit_ratio{cache_name}                       # Cache effectiveness
```

### Dashboards

Every service must have a dashboard showing its RED metrics. The dashboard must be the first place on-call engineers look during an incident — not logs.

---

## Error Tracking

Use an error aggregation service (Sentry, Bugsnag, Rollbar, Datadog APM). Raw log scanning is not a substitute.

**Why:** An error happening 10,000 times a minute looks the same as one happening once in raw logs if you're not aggregating. Error trackers group identical errors, show trends over time, and capture full stack traces with context.

### What to capture on every error

```typescript
// Capture with context, not just the error
Sentry.withScope(scope => {
  scope.setUser({ id: userId })         // who was affected
  scope.setTag('endpoint', req.path)    // where it happened
  scope.setExtra('requestId', requestId) // correlation
  Sentry.captureException(error)
})
```

### Error budget

Set an error rate target per service (e.g., < 0.1% of requests). Alert when it's exceeded. Error budgets make "how reliable is this?" a measurable question rather than a feeling.

---

## Health Checks

Every service must expose health check endpoints:

```
GET /health/live     → 200 if the process is running (used by Kubernetes liveness probe)
GET /health/ready    → 200 if the service can handle traffic (used by readiness probe)
```

The readiness check should verify critical dependencies (DB connection, cache connection). A service that's running but can't reach its database should not receive traffic.

```typescript
app.get('/health/ready', async (req, res) => {
  try {
    await db.raw('SELECT 1')           // verify DB is reachable
    await redis.ping()                 // verify cache is reachable
    res.json({ status: 'ok' })
  } catch (error) {
    res.status(503).json({ status: 'unavailable', error: error.message })
  }
})
```

---

## Alerting

### Alert on symptoms, not causes

**Bad:** "CPU usage > 80%" (cause — might not affect users)
**Good:** "Error rate > 1% for 5 minutes" (symptom — users are definitely affected)

Alert on what users experience: error rates, latency percentiles, availability. Use metrics about infrastructure (CPU, memory) only for capacity planning, not paging.

### Alert fatigue kills on-call effectiveness

- Every alert that fires must be actionable — if you can't do anything about it, don't alert on it
- Every alert must have a runbook — a document explaining what to do when it fires
- Review alert noise monthly — alerts that fire and resolve without action are false positives

### Minimum alert set per service

| Alert | Threshold | Severity |
|---|---|---|
| Error rate | > 1% for 5 min | Page |
| p99 latency | > 2× baseline for 10 min | Page |
| Service down | 0 healthy instances | Page immediately |
| Error budget burn | > 5% in 1 hour | Ticket |
| Disk space | > 85% full | Ticket |

---

## Logging in Practice

### Wrap your logger — never call the logging library directly

```typescript
// lib/logger.ts — single wrapper, configured once
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.SERVICE_NAME },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'req.body.password', '*.token'],
})
```

This gives you one place to: add required fields, configure redaction, control output format, and swap libraries later.

### Log at service boundaries, not inside every function

Log when a request comes in, when it completes, when it fails, and when you make an outbound call. Don't log inside every business logic function — that creates noise. The request/response boundary is the important event.
