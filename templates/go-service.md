# CLAUDE.md — Go Microservice / API

## Project Overview

<!-- FILL IN -->

**Stack:** Go 1.22+, PostgreSQL, HTTP (net/http or Chi/Gin)
**Status:** <!-- Active development / Production / Maintenance -->

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Go 1.22+ |
| HTTP Router | <!-- net/http (stdlib) / Chi / Gin --> |
| Database | PostgreSQL |
| DB Layer | <!-- sqlc / pgx / GORM (avoid) --> |
| Migrations | golang-migrate |
| Config | envconfig / viper |
| Testing | testing (stdlib), testify |
| Containerization | Docker, docker-compose |

---

## Project Structure

```
cmd/
└── server/
    └── main.go              # Entry point — only wiring, no logic
internal/
├── api/
│   ├── handlers/            # HTTP handlers (thin — delegate to service)
│   ├── middleware/          # Auth, logging, rate limiting
│   └── server.go            # Server setup and routing
├── domain/                  # Business entities and interfaces
│   └── user/
│       ├── entity.go        # Domain types
│       ├── service.go       # Business logic interface + implementation
│       └── repository.go    # DB interface
├── infrastructure/
│   ├── postgres/            # Repository implementations
│   └── config/              # Config loading
└── pkg/                     # Internal shared utilities
migrations/                  # SQL migration files
```

---

## Development Commands

```bash
# Run the service
go run cmd/server/main.go

# Build
go build -o bin/server ./cmd/server

# Run tests
go test ./...                          # All tests
go test ./... -race                    # With race detector (always use in CI)
go test ./... -cover -coverprofile=coverage.out

# View coverage
go tool cover -html=coverage.out

# Lint
golangci-lint run

# Generate (sqlc, mocks, etc.)
go generate ./...

# Database migrations
migrate -database "$DATABASE_URL" -path migrations up
migrate -database "$DATABASE_URL" -path migrations down 1
```

---

## Architecture & Key Patterns

### Hexagonal / Clean architecture
Business logic in `internal/domain/` has zero knowledge of HTTP or PostgreSQL. Handlers and repositories are adapters. This makes the domain fully testable without a DB or HTTP server.

```
HTTP Handler → Service (domain) → Repository Interface
                                        ↑
                              Postgres Implementation
```

### Error handling
Go errors are values — handle them explicitly at every call site.

```go
// Return domain errors, not infrastructure errors
var ErrUserNotFound = errors.New("user not found")

// Wrap with context for debugging
return fmt.Errorf("UserService.GetByID: %w", err)

// In handlers: map domain errors to HTTP status codes
if errors.Is(err, domain.ErrUserNotFound) {
    http.Error(w, "not found", http.StatusNotFound)
    return
}
```

Never swallow errors with `_`. Never panic in library code.

### Context propagation
Always pass `context.Context` as the first parameter to any function that does I/O. Use `ctx.Done()` to respect cancellation in long-running operations.

### Interfaces
Define interfaces at the point of use (in the consumer package), not at the point of definition. Small interfaces (1–3 methods) are better than large ones.

```go
// In the handler package, not in the repository package
type UserRepository interface {
    GetByID(ctx context.Context, id uuid.UUID) (*User, error)
    Create(ctx context.Context, user *User) error
}
```

### Configuration
Load all config at startup via environment variables. Validate required fields and fail fast with a clear message if any are missing. Never read `os.Getenv` inside business logic.

### Concurrency
- Use `sync.WaitGroup` + channels for fan-out patterns
- Use `errgroup.Group` for concurrent operations that can fail
- Never share mutable state across goroutines without synchronization
- Prefer message-passing over shared memory

---

## Testing Requirements

### Test types
- **Unit tests**: Domain services with mocked repository interfaces (`testify/mock`)
- **Integration tests**: Repository implementations against a real PostgreSQL test DB
- **HTTP tests**: Handler tests using `httptest.NewRecorder` and the real router

### Test database
Use `docker-compose.test.yml` with a dedicated PostgreSQL container. Apply migrations in `TestMain`. Clean up tables between tests with truncation, not DROP.

### Race detection
All CI runs must use `-race`. If a test only fails under the race detector, the production code has a data race.

```go
func TestMain(m *testing.M) {
    // Setup test DB
    os.Exit(m.Run())
}
```

---

## Security Requirements

- Validate all input in handlers before passing to services
- Use prepared statements via `sqlc` or `pgx` — never fmt.Sprintf into a query
- JWT validation in middleware — don't re-validate in handlers
- Secrets via environment variables — never in source code or config files
- Set appropriate timeouts on all HTTP clients and DB connections:
  ```go
  &http.Client{Timeout: 10 * time.Second}
  ```
- Never log request/response bodies containing auth tokens or PII

---

## Performance Guidelines

- Profile before optimizing — `pprof` is built in
- Use `sync.Pool` for frequently allocated objects in hot paths
- Avoid reflection in hot paths — it's 10–100x slower
- DB connection pool: `SetMaxOpenConns(25)`, `SetMaxIdleConns(5)` for typical workloads
- Use `LIMIT` on all list queries — never unbounded selects
- Benchmark with `go test -bench=. -benchmem` before claiming a performance improvement

---

## Environment Variables

```bash
# Server
PORT=8080
ENVIRONMENT=development

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname?sslmode=disable
DATABASE_URL_TEST=postgres://user:pass@localhost:5432/dbname_test?sslmode=disable

# Auth
JWT_SECRET=
JWT_EXPIRY_HOURS=24

# Observability
LOG_LEVEL=info
```

---

## AI Agent Behavior

- Always run `go vet ./...` and `golangci-lint run` before suggesting code is complete
- Use `errors.Is` and `errors.As` for error checking — never string comparison
- The `-race` flag is not optional — include it in test commands
- New DB queries go through `sqlc` — add the SQL to `queries/` and regenerate, don't write raw pgx queries
- Goroutine leaks are bugs — every spawned goroutine must have a clear termination path
