---
description: Test-driven development workflow. Write failing test first, implement to pass, then refactor. Use when building any new feature or fixing a bug.
---

# TDD Workflow

A strict red-green-refactor cycle for building features with confidence.

## When to use
- Implementing a new feature or function
- Fixing a bug (write the failing test first to prove you understand the bug)
- Refactoring (tests confirm behavior is preserved)

---

## Workflow

### Step 0 — Understand before you test
Before writing a single line, read the relevant existing code:
- What functions or classes already exist that this feature builds on?
- What patterns are already used for similar features?
- What tests already exist that might be related?

State your understanding in one sentence: "This feature will add X to Y by doing Z."

### Step 1 — Red: Write a failing test

Write the smallest test that captures the core behavior of what you're building.

```
Test requirements:
- Name the test to describe the expected behavior: "returns null when user does not exist"
- Follow Arrange-Act-Assert structure
- Use the project's actual test framework and file conventions
- Run the test and confirm it fails (not errors — fails)
```

If the test errors instead of failing, fix the setup first. A failing test is progress. An erroring test is a broken test harness.

### Step 2 — Green: Write the minimum implementation

Write the simplest code that makes the test pass. This is not the final code — it's the skeleton that proves your test is testing the right thing.

```
Implementation rules:
- Write only what the test requires
- Do not add error handling for cases the test doesn't cover yet
- Do not optimize
- Do not add features not captured by a test
```

Run the test. It must pass. If it doesn't, the implementation is wrong — fix it before continuing.

### Step 3 — Expand test coverage

Add tests for:
- Edge cases: null/undefined/empty input, 0, negative values, very large values
- Error cases: what should happen when input is invalid
- Boundary conditions specific to this feature

Run all new tests. They should fail. Fix them by updating the implementation. Do not skip the red phase for edge cases.

### Step 4 — Refactor

With all tests passing, improve the implementation:
- Extract repeated logic into helpers
- Improve naming
- Simplify conditionals
- Remove duplication introduced during the green phase

After each refactor step, run the full test suite. If anything breaks, undo the last change — don't try to "fix" a broken refactor.

### Step 5 — Integration

If this is a function that integrates with other parts of the system:
- Write an integration test that exercises the full path from entry point to output
- This test should not mock internal dependencies — use the real implementations

Run the full test suite one final time.

### Step 6 — Type check and lint

```bash
# Run these before marking the feature complete
pnpm typecheck    # or: mypy src/ / go vet ./...
pnpm lint         # or: ruff check / golangci-lint run
```

Fix all errors. A passing test suite with type errors is not done.

---

## Checklist before calling the feature complete

- [ ] All new tests pass
- [ ] No existing tests were broken
- [ ] Edge cases and error paths are tested
- [ ] Type checker passes
- [ ] Linter passes
- [ ] No debugging code left in (console.log, print, TODO comments)
- [ ] Code reads cleanly without needing comments to explain it
