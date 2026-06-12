# CLAUDE.md — Python API (FastAPI / Django / Flask)

## Project Overview

<!-- FILL IN -->

**Stack:** Python 3.11+, FastAPI (or Django/Flask), PostgreSQL, SQLAlchemy / Django ORM
**Status:** <!-- Active development / Production / Maintenance -->

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Framework | <!-- FastAPI / Django / Flask --> |
| Database | PostgreSQL |
| ORM | <!-- SQLAlchemy 2.0 / Django ORM / SQLModel --> |
| Validation | Pydantic v2 |
| Auth | <!-- FastAPI-Users / Django auth / JWT --> |
| Task Queue | <!-- Celery + Redis / RQ --> |
| Testing | pytest, pytest-asyncio, httpx |
| Packaging | uv / pip + requirements.txt |

---

## Project Structure

### FastAPI layout
```
src/
├── api/
│   ├── v1/
│   │   ├── routes/          # Route handlers (thin — delegate to services)
│   │   └── dependencies.py  # FastAPI dependency injection
│   └── middleware.py
├── core/
│   ├── config.py            # Settings via Pydantic BaseSettings
│   ├── database.py          # SQLAlchemy session factory
│   └── security.py          # JWT, password hashing
├── models/                  # SQLAlchemy ORM models
├── schemas/                 # Pydantic request/response schemas
├── services/                # Business logic (no HTTP concerns)
├── repositories/            # Database access layer
└── tests/
    ├── conftest.py          # Fixtures, test DB setup
    ├── unit/
    └── integration/
```

---

## Development Commands

```bash
# Install dependencies (uv recommended)
uv sync                   # or: pip install -r requirements.txt

# Start development server
uvicorn src.main:app --reload --port 8000

# Run tests
pytest                    # All tests
pytest tests/unit/        # Unit tests only
pytest -x                 # Stop on first failure
pytest --cov=src          # With coverage

# Type check
mypy src/

# Lint + format
ruff check src/
ruff format src/

# Database
alembic upgrade head      # Apply migrations
alembic revision --autogenerate -m "description"  # New migration
alembic downgrade -1      # Rollback one step
```

---

## Architecture & Key Patterns

### Layer responsibilities

| Layer | What it owns | What it doesn't own |
|---|---|---|
| Routes | HTTP in/out, auth deps, request validation | Business logic, DB queries |
| Services | Business logic, orchestration | HTTP details, DB session management |
| Repositories | Database queries | Business logic, HTTP |
| Schemas | Serialization, validation contracts | DB models |
| Models | DB schema | Validation, business logic |

### Dependency injection
Use FastAPI's `Depends()` for:
- Database session (`get_db`)
- Current user (`get_current_user`)
- Config (`get_settings`)

Never instantiate these directly in route handlers.

### Settings management
All config via Pydantic `BaseSettings` in `core/config.py`. Access via `get_settings()` dependency, never import the settings object directly in route handlers.

```python
class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: Literal["development", "staging", "production"] = "development"

    model_config = SettingsConfigDict(env_file=".env")
```

### Database sessions
- One session per request via `get_db` dependency
- Never use `Session` outside of repository methods
- Use `async with` for async sessions — never leave sessions open
- Repository methods receive the session as a parameter — don't create sessions inside repositories

### Error handling
```python
# In services: raise domain exceptions
raise UserNotFoundError(user_id)

# In routes: catch and convert to HTTP responses
@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request, exc):
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

Never let SQLAlchemy exceptions propagate to the client.

---

## Pydantic & Validation Rules

- Use Pydantic v2 models for all request/response schemas
- Separate request schemas (input) from response schemas (output) — they often differ
- Use `model_validator` for cross-field validation
- Use `Field(...)` to document constraints: `Field(..., min_length=1, max_length=255)`
- Never return ORM model objects directly from routes — always serialize through a schema

---

## Testing Requirements

### Test database
Use a separate test database. Override `DATABASE_URL` in `conftest.py` fixtures. Apply migrations before the test session runs.

```python
# conftest.py pattern
@pytest.fixture(scope="session")
def test_db():
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
```

### Test policy
- **Unit tests**: Services and utilities with mocked repositories
- **Integration tests**: Full request → DB cycle using `httpx.AsyncClient` with the real FastAPI app
- **Never mock** the ORM in integration tests — use a real test DB
- Use `pytest.mark.asyncio` for all async tests; configure `asyncio_mode = "auto"` in `pytest.ini`

---

## Security Requirements

- JWT tokens expire — set `ACCESS_TOKEN_EXPIRE_MINUTES` appropriately (15–60 minutes)
- Hash passwords with `bcrypt` or `argon2` — never MD5 or SHA1
- Validate all path parameters and query params with Pydantic — FastAPI does this automatically if typed
- Use `Depends(get_current_active_user)` on every protected endpoint
- Rate limit with `slowapi` on auth endpoints (login, signup, password reset)
- Never include stack traces in production error responses — set `debug=False` in production

---

## Performance Guidelines

- Use `async def` for route handlers that do I/O (DB, HTTP calls)
- Use `def` (sync) for CPU-bound operations — don't block the event loop
- Batch DB queries — use `selectinload` or `joinedload` to avoid N+1 queries
- Add indexes to all foreign keys and frequently filtered columns
- Use Redis for caching expensive queries (TTL-based, not manual invalidation)
- Set connection pool limits: `pool_size=10, max_overflow=20` for production

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname
DATABASE_URL_TEST=postgresql+asyncpg://user:pass@localhost/dbname_test

# Auth
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
ENVIRONMENT=development
LOG_LEVEL=INFO

# External services
# REDIS_URL=redis://localhost:6379
```

---

## AI Agent Behavior

- Run `mypy src/` after any type annotation changes
- Use `ruff check --fix src/` before suggesting code changes
- When adding a new endpoint, always add a corresponding integration test
- Alembic migrations are generated, not hand-written — run `alembic revision --autogenerate` then review the generated file before applying
- Never use `text()` for SQL queries — always use ORM methods or parameterized queries
