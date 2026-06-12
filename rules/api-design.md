# API Design Rules

## REST Conventions

### URL structure
- Use nouns, not verbs: `/users`, not `/getUsers`
- Use lowercase kebab-case: `/user-profiles`, not `/userProfiles`
- Use plural nouns for collections: `/orders`, `/products`
- Nest resources to show ownership: `/users/{id}/orders`, `/orders/{id}/items`
- Limit nesting to 2 levels — deeper nesting signals a design problem

```
GET    /users              # list users
POST   /users              # create a user
GET    /users/{id}         # get one user
PATCH  /users/{id}         # partial update
PUT    /users/{id}         # full replace
DELETE /users/{id}         # delete

GET    /users/{id}/orders  # get orders for a user
POST   /users/{id}/orders  # create an order for a user
```

### Action endpoints
For operations that don't map cleanly to CRUD, use a verb after the resource:

```
POST /orders/{id}/cancel
POST /users/{id}/verify-email
POST /payments/{id}/refund
```

---

## HTTP Status Codes

Use the right status code — clients use these to decide how to handle responses.

### 2xx Success
| Code | When to use |
|---|---|
| `200 OK` | Successful GET, PATCH, PUT |
| `201 Created` | Successful POST that creates a resource |
| `204 No Content` | Successful DELETE or action with no response body |

### 4xx Client errors
| Code | When to use |
|---|---|
| `400 Bad Request` | Validation failure, malformed request body |
| `401 Unauthorized` | Missing or invalid authentication credentials |
| `403 Forbidden` | Authenticated but not authorized for this resource |
| `404 Not Found` | Resource doesn't exist |
| `409 Conflict` | Request conflicts with current state (e.g., duplicate email) |
| `422 Unprocessable Entity` | Syntactically valid but semantically invalid request |
| `429 Too Many Requests` | Rate limit exceeded |

### 5xx Server errors
| Code | When to use |
|---|---|
| `500 Internal Server Error` | Unexpected error — don't expose details |
| `502 Bad Gateway` | Upstream service failure |
| `503 Service Unavailable` | Intentional downtime or overload |

**Common mistake:** Using `400` for all errors, or `500` for validation failures. Use the most specific applicable code.

---

## Request & Response Shape

### Consistent error format
All error responses must follow the same shape so clients can handle them uniformly:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields",
    "details": [
      { "field": "email", "message": "must be a valid email address" },
      { "field": "age", "message": "must be at least 18" }
    ]
  }
}
```

- `code`: machine-readable constant (snake_case or UPPER_SNAKE_CASE) — clients switch on this
- `message`: human-readable explanation
- `details`: optional array for validation errors with field-level context

### Consistent success format
For list endpoints, always wrap in an object (not a bare array) to allow future pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "total": 143,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true
  }
}
```

For single-resource endpoints:
```json
{
  "data": { "id": "...", "name": "..." }
}
```

### Date and time
- Always use ISO 8601 format: `"2024-03-15T14:30:00Z"`
- Always use UTC — never local time in API responses
- Include timezone explicitly — `Z` suffix or `+00:00`

### IDs
- Use UUIDs (v4 or v7) for public-facing IDs — not sequential integers (enumerable, fingerprintable)
- Use strings for IDs in JSON — JavaScript loses precision on integers above `2^53`

---

## Pagination

### Offset pagination
Simple to implement, works well for small datasets and random access:

```
GET /products?page=2&pageSize=20
```

Response:
```json
{
  "data": [...],
  "pagination": { "total": 500, "page": 2, "pageSize": 20, "hasNextPage": true }
}
```

### Cursor pagination
Necessary for large datasets and real-time feeds — offset pagination breaks when items are added/deleted:

```
GET /feed?cursor=eyJpZCI6MTIzfQ&limit=20
```

Response:
```json
{
  "data": [...],
  "nextCursor": "eyJpZCI6MTQzfQ",
  "hasMore": true
}
```

Use cursor pagination when: the dataset is large (10k+), items are added in real time, or users scroll infinitely.

---

## Versioning

### URL versioning (recommended)
```
/api/v1/users
/api/v2/users
```

Simple, explicit, easy to route. Clients know exactly which version they're using.

### When to increment the major version
A major version bump is required for any **breaking change**:
- Removing a field from a response
- Changing a field's type
- Renaming a field
- Changing behavior that clients depend on

### Non-breaking changes (no version bump needed)
- Adding new optional fields to a response
- Adding new optional request parameters
- Adding new endpoints
- Making a required field optional

### Deprecation
Before removing a version:
1. Add a `Deprecation` header to responses: `Deprecation: version="v1", sunset="2025-01-01"`
2. Announce with at least 6 months notice
3. Track which clients are still using the deprecated version via analytics/logs

---

## Request Validation

Validate before processing. Return descriptive errors for all invalid inputs.

```typescript
// Validate the full request shape upfront
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
  metadata: z.record(z.string()).optional(),
})

const parsed = schema.safeParse(req.body)
if (!parsed.success) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      details: parsed.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    }
  })
}
```

---

## Rate Limiting

Every public endpoint should have rate limiting. Apply stricter limits to:
- Auth endpoints (login, signup, password reset): 5–10 requests per minute per IP
- Expensive operations (search, bulk operations): 20–60 per minute
- Standard CRUD: 100–300 per minute

Return `429 Too Many Requests` with a `Retry-After` header:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710000060
```

---

## Documentation

Every API endpoint must be documented with:
- Description of what the endpoint does
- Required and optional parameters with types and constraints
- Example request and response
- All possible error codes and their meaning

Use OpenAPI/Swagger for machine-readable documentation. Auto-generate it from code (FastAPI, tRPC, zod-openapi) rather than maintaining it separately — hand-maintained docs go stale.
