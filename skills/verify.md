---
description: Verification and regression check after a change. Confirms the change works as intended and hasn't broken existing behavior. Run after implementing any fix or feature.
---

# Verify Workflow

A structured check to confirm a change works correctly and hasn't introduced regressions.

## When to use
- After implementing a fix or feature
- After a refactor to confirm behavior is preserved
- When a CI failure is unclear and you want to diagnose locally
- Before marking a task as done

---

## Workflow

### Step 1 — Confirm the change compiles / parses

```bash
pnpm typecheck        # TypeScript
mypy src/             # Python
go build ./...        # Go
flutter analyze       # Flutter
```

If this fails, the change is not done. Fix type errors before continuing.

### Step 2 — Run targeted tests

Run tests specifically for the code that changed:

```bash
# Run tests for a specific file or directory
pnpm test src/services/user.service.test.ts
pytest tests/unit/test_user_service.py
go test ./internal/users/...
```

All targeted tests must pass. If they don't, investigate and fix before running the full suite — don't let a failing targeted test get lost in the noise of the full run.

### Step 3 — Run the full test suite

```bash
pnpm test             # All unit + integration tests
pytest                # Python full suite
go test ./... -race   # Go with race detector
flutter test          # Flutter
```

Note any failures. If a failing test is unrelated to your change, document it explicitly — don't ignore it.

### Step 4 — Manual verification of the change

For the specific behavior that was changed or added:

1. Identify the entry point (API endpoint, function, UI interaction)
2. Exercise the happy path manually or with a targeted test
3. Exercise at least one edge case (empty input, boundary value, error condition)
4. Confirm the output matches what was expected

For bug fixes specifically: reproduce the bug with the old code (mentally or with git stash), then confirm it's gone with the new code.

### Step 5 — Regression check for related areas

Identify code that could be indirectly affected by the change:
- Functions that call the changed function
- Tests that cover related behavior
- Any shared state or database tables touched by the change

Run tests for those areas:
```bash
pnpm test src/services/     # Test the whole services layer
pytest tests/integration/   # Run integration tests
```

### Step 6 — Lint check

```bash
pnpm lint             # ESLint
ruff check src/       # Python
golangci-lint run     # Go
```

Zero warnings before calling this done. Lint warnings are future bugs waiting to happen.

### Step 7 — Check for accidental changes

```bash
git diff                    # Unstaged changes
git diff --staged           # Staged changes
git status                  # Untracked files
```

Review everything in the diff. Confirm:
- No debug code left in (`console.log`, `print`, breakpoints, hardcoded test values)
- No unintended file modifications
- No accidentally staged files (`.env`, build artifacts)

### Step 8 — Final summary

State clearly:
- What was changed and why
- What was tested (manually and via test suite)
- Whether all tests pass
- Any known limitations or edge cases not yet covered
- Anything that should be followed up in a future task

---

## Verification failed — what to do

If any step fails:

1. **Tests fail**: Read the failure message carefully. Is it the change, or a pre-existing failure? Fix the change; document pre-existing failures in the PR.

2. **Type errors**: These are bugs, not style issues. Fix them before proceeding.

3. **Manual verification fails**: The implementation is incomplete. Return to the implementation, don't mark done.

4. **Regression found**: Stop. Understand the regression before continuing. Don't work around it.

Never mark a task done while a test is failing or a type error is present.
