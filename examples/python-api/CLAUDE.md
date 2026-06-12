# CLAUDE.md — Python REST API (FastAPI)

## Project Overview

A production-ready REST API built with FastAPI. Handles user management, authentication, and core business operations. Designed for deployment as a standalone service or as the backend for a web/mobile frontend.

**Status:** Active development
**Team:** 2–4 engineers
**Primary language:** Python 3.11+

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.110+ |
| Language | Python 3.11+ |
| Database | PostgreSQL 15 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Auth | JWT (python-jose) + bcrypt |
| Task Queue | Celery + Redis |
| Testing | pytest + httpx + pytest-asyncio |
| Packaging | uv |
| Container | Docker + docker-compose |

---

## Project Structure

```
src/
├── api/
│   ├── v1/
│   │   ├── routes/           # HTTP handlers — thin, delegate to services
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   └── items.py
│   │   └── dependencies.py   # FastAPI Depends() functions
│   └── middleware.py         # Logging, CORS, rate limiting
├── core/
│   ├── config.py             # Pydantic Settings — all config lives here
│   ├── database.py           # Async SQLAlchemy session factory
│   ├── security.py           # JWT creation/validation, password hashing
│   └── exceptions.py        # Domain exception classes
├── models/                   # SQLAlchemy ORM models
│   ├── user.py
│   └── item.py
├── schemas/                  # Pydantic request/response schemas
│   ├── user.py               # UserCreate, UserRead, UserUpdate
│   └── item.py
├── services/                 # Business logic (no HTTP, no SQL)
│   ├── user_service.py
│   └── item_service.py
├── repositories/             # Database access layer
│   ├── user_repository.py
│   └── item_repository.py
├── workers/                  # Celery tasks
│   └── email_tasks.py
└── tests/
    ├── conftest.py           # Fixtures, test DB setup
    ├── unit/                 # Service tests with mocked repos
    └── integration/          # Full request → DB tests
migrations/
├── alembic.ini
└── versions/
```

---

## Development Commands

```bash
# Install dependencies
uv sync

# Start dev server (with auto-reload)
uvicorn src.main:app --reload --port 8000

# API docs
# Swagger UI: http://localhost:8000/docs
# ReDoc:      http://localhost:8000/redoc

# Tests
pytest                                    # All tests
pytest tests/unit/                        # Unit only
pytest tests/integration/                 # Integration only
pytest -x --tb=short                      # Stop on first failure
pytest --cov=src --cov-report=html        # With coverage report

# Type checking
mypy src/

# Lint + format
ruff check src/ && ruff format --check src/
ruff check --fix src/ && ruff format src/   # Auto-fix

# Database
alembic upgrade head                       # Apply all migrations
alembic revision --autogenerate -m "add user roles"  # New migration
alembic downgrade -1                       # Rollback one

# Start supporting services (DB + Redis)
docker-compose up -d postgres redis

# Run workers
celery -A src.workers worker --loglevel=info
```

---

## Architecture & Key Patterns

### Layer responsibilities

```
Route Handler → Depends() injects DB session + current user
     ↓
Service (business logic, no HTTP, no direct DB)
     ↓
Repository (DB queries via SQLAlchemy, returns domain models)
     ↓
PostgreSQL
```

Rules:
- Route handlers validate input (Pydantic) and return responses — nothing else
- Services own business logic — they never touch `Request` or `Response`
- Repositories own SQL — they return ORM model instances
- Never put business logic in repositories, never put SQL in services

### Dependency injection pattern
```python
# All shared resources via Depends()
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    ...

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)
```

### Configuration
All config in `core/config.py` via Pydantic `BaseSettings`. Access via the `get_settings()` dependency — never call `os.getenv()` outside of `config.py`.

### Error handling
Define domain exceptions in `core/exceptions.py`. Register handlers at the app level in `main.py`. Routes should never catch exceptions they didn't raise.

```python
# core/exceptions.py
class UserNotFoundError(Exception):
    def __init__(self, user_id: int):
        self.user_id = user_id

# main.py
@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request: Request, exc: UserNotFoundError):
    return JSONResponse(status_code=404, content={"detail": f"User {exc.user_id} not found"})
```

### Async rules
- All route handlers and services must be `async def` — never block the event loop
- CPU-bound operations: use `run_in_executor` or a dedicated Celery worker
- Database: always use `await` — never call sync SQLAlchemy methods in async context

---

## Testing Requirements

### Test database
`conftest.py` creates a dedicated test database, applies all Alembic migrations, and provides an `AsyncSession` fixture that rolls back after each test.

```python
# conftest.py — the key fixture
@pytest.fixture
async def db(test_engine):
    async with AsyncSession(test_engine) as session:
        async with session.begin():
            yield session
            await session.rollback()
```

### Policy
- Unit tests: mock the repository layer, test service logic
- Integration tests: use `httpx.AsyncClient` with `app` as the ASGI transport, real DB
- Never mock SQLAlchemy in integration tests — it defeats the purpose

### Async test config
```ini
# pytest.ini
[pytest]
asyncio_mode = auto
```

---

## Security Requirements

- Passwords hashed with `bcrypt` (cost factor 12) — never store or log plaintext
- JWT tokens: validate signature, expiry (`exp`), and issuer (`iss`) on every request
- Access tokens: 15-minute expiry; refresh tokens: 7-day expiry with rotation
- All auth endpoints rate-limited: `slowapi` with Redis backend
- CORS: configured in `middleware.py` — only permit known frontend origins in production

---

## Known Pitfalls

- SQLAlchemy 2.0 async requires `AsyncSession` — mixing sync and async session methods causes errors
- Alembic autogenerate doesn't detect all changes (e.g., column type changes, custom types) — always review generated migration before applying
- Celery tasks must be idempotent — they may be retried on failure or network issues
- Pydantic v2 `model_validate(orm_object)` requires `model_config = ConfigDict(from_attributes=True)` on the schema

---

## Environment Variables

```bash
# App
APP_ENV=development
SECRET_KEY=
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/appdb
DATABASE_URL_TEST=postgresql+asyncpg://user:pass@localhost:5432/appdb_test

# Auth
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis / Celery
REDIS_URL=redis://localhost:6379/0

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

---

## AI Agent Behavior

- Run `mypy src/` and `ruff check src/` after every change
- Alembic migrations are auto-generated: run `alembic revision --autogenerate` then review the file — never write migrations by hand
- When adding a new endpoint, always add a corresponding integration test in `tests/integration/`
- SQLAlchemy 2.0 syntax differs from 1.x — check the version in `pyproject.toml` before suggesting ORM patterns
- Use `pytest -x` to stop on first failure during debugging — don't let failures accumulate
