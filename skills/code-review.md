---
description: Structured self-review workflow before opening a PR. Reviews for correctness, security, test coverage, and code quality. Run on your own changes before requesting human review.
---

# Code Review Workflow

A self-review process to catch issues before they reach human reviewers or production.

## When to use
- Before opening a pull request
- After completing a feature to quality-check your own work
- When you want a structured second pass on a significant change

---

## Workflow

### Step 1 — Get the diff
```bash
git diff main...HEAD          # All changes vs. main
git diff HEAD~1               # Last commit only
git status                    # Untracked/unstaged files
```

Read the full diff before forming any opinions.

### Step 2 — Correctness check

For each changed function or method, ask:

**Does it do what it claims to do?**
- Trace through the logic manually for the happy path
- Trace through for at least one edge case (null input, empty list, zero, concurrent call)
- Check return types — is the return value always what callers expect?

**Can it fail silently?**
- Is there any code path that returns a wrong answer instead of an error?
- Are all error paths handled and surfaced?

**Are there race conditions?**
- If this runs concurrently, can two calls interfere with each other?
- Are shared resources properly protected?

### Step 3 — Security check

Go through this checklist for every file that handles external input:

- [ ] All user inputs validated before use (schema validation, not just type checking)
- [ ] No SQL string concatenation — parameterized queries or ORM only
- [ ] No user content rendered as raw HTML
- [ ] Auth check present on every protected operation (not just at the route level)
- [ ] No hardcoded credentials, keys, or tokens
- [ ] Error messages don't expose stack traces or internal structure

If any box is unchecked, stop and fix it before continuing.

### Step 4 — Test coverage check

```bash
pnpm test --coverage           # or the project's equivalent
```

Review the coverage report for the files you changed:
- Is every new code path covered by a test?
- Are error paths tested, not just the happy path?
- Do the tests actually assert on meaningful output — not just that a function was called?
- Would the tests catch a regression if the implementation was subtly broken?

### Step 5 — Code quality check

Read the changed code as if you're seeing it for the first time:

**Naming**
- Do variable and function names tell you what they contain/do?
- Are booleans named with `is`/`has`/`should`?
- Are there any single-letter variables or cryptic abbreviations?

**Complexity**
- Are any functions over 50 lines? If so, can they be split?
- Is nesting deeper than 4 levels? If so, can early returns flatten it?
- Are there magic numbers? Replace with named constants.

**Duplication**
- Is any logic repeated? Extract it.
- Did you copy-paste anything? That's a smell — either reuse or extract.

**Comments**
- Are there comments explaining WHAT the code does? Delete them — the code should be readable.
- Are there comments explaining WHY (a non-obvious decision, a workaround for a bug)? Keep them.
- Are there any `TODO` comments without a ticket number? Resolve them or add a reference.

### Step 6 — Type check and lint
```bash
pnpm typecheck                 # TypeScript: tsc --noEmit
pnpm lint                      # ESLint / Ruff / golangci-lint
```

Fix all errors and warnings. Zero tolerance before a PR.

### Step 7 — Run the full test suite
```bash
pnpm test                      # All unit + integration tests
```

All tests must pass. If any are failing that aren't related to your change, document that in the PR description.

### Step 8 — Write the PR description

Use this template:
```
## What
One sentence: what does this PR do?

## Why
What problem does this solve? Why is this the right approach?

## Testing
How was this tested? List the test cases you added.

## Notes
Anything the reviewer should pay special attention to, or any decisions you made that aren't obvious from the code.
```

---

## Red flags that require a second look

If any of these are true, slow down and reconsider:

- The change is larger than 400 lines
- You removed tests instead of fixing them
- You added `@ts-ignore` or `// eslint-disable`
- You changed the database schema without a migration
- You changed auth logic
- You're not sure how to test something
