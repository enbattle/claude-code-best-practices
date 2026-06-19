# Testing Rules

## Adaptive Testing Approach

Before applying any rule in this file, check what testing conventions already exist in the project. The goal is consistency with the existing codebase — not imposing a methodology on a project that has already chosen one.

### How to detect existing conventions

```bash
# Check for test config files
ls jest.config.* vitest.config.* pytest.ini pyproject.toml setup.cfg .mocharc.* 2>/dev/null

# Check the test script in package.json
cat package.json | grep -A5 '"test"'

# Look at existing test files to understand the pattern in use
find . -name "*.test.*" -o -name "*.spec.*" | head -10
ls tests/ test/ __tests__/ 2>/dev/null
```

### If a convention already exists

Follow it. If the project uses test-after with integration tests as the primary suite, write integration tests. If it uses BDD-style (`describe/it` with plain-language naming), follow that. If tests live in `__tests__/` directories, put yours there. Don't introduce a parallel style.

### If no convention exists (new project or first tests)

Default to TDD (test-driven development) using the red-green-refactor cycle. It produces better-designed code, and starting a project with TDD is much easier than retrofitting it later. The `/tdd-workflow` skill walks through the full cycle step by step.

---

## Coverage Requirements

- **Business logic**: 80% minimum line coverage
- **Security-critical paths** (auth, payments, access control): 100% coverage
- **Utilities and pure functions**: 100% coverage
- **UI components**: render tests + interaction tests for all interactive elements
- Coverage is a floor, not a goal — 80% with meaningful tests beats 95% with snapshot tests

---

## Test Types & When to Write Each

### Unit tests
Test a single function or class in isolation. All dependencies are mocked or replaced with fakes.

**Write unit tests for:**
- Pure functions and utilities
- Business logic in services
- Data transformation functions
- Validation logic

**Don't write unit tests for:**
- Trivial getters/setters
- Framework boilerplate
- Code that's just wiring (it's better tested by integration tests)

### Integration tests
Test a slice of the system end-to-end, from the API boundary to the database. Use real infrastructure (test DB), not mocks.

**Write integration tests for:**
- Every API endpoint (at least happy path + primary error path)
- Database queries and transactions
- Authentication and authorization flows

**Critical rule:** Never mock the database in integration tests. Mocked DB tests pass when production code fails — this is a false sense of security that hides real bugs.

### End-to-end (e2e) tests
Test the full application from the user's perspective in a real browser or device.

**Write e2e tests for:**
- The signup and login flow
- The core user journey (the one action users do most)
- Checkout/payment flow (if applicable)
- Critical admin operations

E2e tests are expensive — keep the suite focused on critical paths only.

---

## Test-Driven Development (TDD)

For new features and bug fixes, follow the red-green-refactor cycle:

1. **Red**: Write a failing test that defines the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up the implementation without breaking the test
4. Repeat

### For bug fixes specifically
Write a test that reproduces the bug *before* fixing it. This proves you understand the bug and prevents regression. A fix without a test is a promise you'll fix it again.

---

## Test Structure

### Arrange-Act-Assert (AAA)

```typescript
it('returns empty array when no products match the category', async () => {
  // Arrange
  const category = 'nonexistent-category'
  await seedProducts([{ category: 'electronics' }, { category: 'clothing' }])

  // Act
  const result = await getProductsByCategory(category)

  // Assert
  expect(result).toEqual([])
})
```

Keep each section clearly separated. One assert per test is ideal — multiple asserts make it harder to identify what failed.

### Test naming
Name tests to describe the behavior, not the implementation:

```
// Bad: describes the implementation
"test getUserById function"
"calls the database"

// Good: describes the expected behavior
"returns null when user does not exist"
"throws AuthError when session is expired"
"sends a welcome email after successful signup"
```

Use `describe` blocks to group related tests. The test name should complete the sentence: `describe('getUser') > it('returns null when user does not exist')`.

---

## Test Isolation

Each test must:
- Set up its own data — never depend on data from another test
- Clean up after itself — or use a transaction that rolls back
- Run in any order and produce the same result
- Not share mutable state with other tests via module-level variables

### Database isolation patterns

```typescript
// Option A: Transaction rollback (fast)
beforeEach(async () => { await db.beginTransaction() })
afterEach(async () => { await db.rollbackTransaction() })

// Option B: Truncate between tests (simpler, slightly slower)
afterEach(async () => { await truncateAllTables() })
```

---

## Mocking Policy

### Mock these
- External HTTP APIs (Stripe, SendGrid, Twilio, etc.)
- The system clock when testing time-sensitive logic (`jest.useFakeTimers`)
- File system I/O in unit tests

### Never mock these
- Your own database in integration tests
- Business logic you own — if you need to mock it, the coupling is wrong
- Core language/framework utilities

### Mocking external APIs
Use contract testing (e.g., Pact) for services you own on both sides. For third-party APIs, record real responses and replay them in tests — this is more reliable than hand-written mocks.

---

## Test Code Quality

Tests are production code. Apply the same standards:
- No magic numbers — use named constants
- No duplication — extract shared setup into fixtures or helpers
- No `any` types in TypeScript tests
- Keep test files colocated with the code they test: `user.service.test.ts` next to `user.service.ts`

### Test helpers and factories

```typescript
// Use factory functions for test data — not hand-written object literals
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  }
}

// Usage
const admin = createUser({ role: 'admin' })
const inactiveUser = createUser({ isActive: false })
```

---

## CI Requirements

- All tests must pass on every pull request before merge
- Test suite must complete in under 5 minutes for unit + integration; e2e can be a separate job
- Flaky tests must be fixed or removed — a test that sometimes fails provides no signal
- Coverage reports must be generated and stored as CI artifacts

---

## When Tests Should Not Be Changed

If a test is failing after a code change:
- **If the code is wrong**: fix the code
- **If the requirement changed**: update the test to reflect the new requirement, document why in the PR
- **Never**: change a test just to make it pass without understanding why it failed

A failing test is information — don't silence it.
