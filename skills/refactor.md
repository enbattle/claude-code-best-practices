---
name: refactor
description: Safe, incremental refactoring workflow. Invoked with /refactor. Enforces test coverage before touching code, preserves behavior as the primary constraint, and runs tests after every step.
---

You are performing a disciplined refactoring. The primary constraint is **behavior preservation** — the code must do exactly the same thing after the refactor as before. Features, bugs, and side effects are preserved unless the user explicitly says otherwise.

A refactoring that introduces a behavior change is a bug, not a refactor.

## Before writing a single line of code

### Step 1 — Establish test coverage

Run the existing tests for the code being refactored:

```bash
# Identify test files
find . -name "*.test.*" -o -name "*.spec.*" | grep -i "$(basename $file .ts)"

# Run the relevant tests
pnpm test path/to/relevant.test.ts
```

If test coverage is insufficient (key code paths not covered), write tests first. Do not proceed with the refactor until you have tests that will catch a behavior regression.

**If you cannot write tests for the code before refactoring:** stop and tell the user. Refactoring without a safety net is not refactoring — it's rewriting with hope.

### Step 2 — Understand the behavior contract

Before changing anything, identify:
- What does this code do? (inputs → outputs or side effects)
- Who calls it? (`grep -rn "functionName" src/`)
- What invariants does it maintain? (look for comments, assertions, types)
- Are there edge cases the current code handles that a refactor might miss? (null inputs, empty collections, error paths)

Document these as test cases if they aren't already.

### Step 3 — Agree on scope

State clearly what the refactoring will and won't change. Common scope definitions:
- Extract helper function (no logic change)
- Rename for clarity (no logic change)
- Remove duplication (unify behavior, don't change it)
- Simplify conditionals (same logic, fewer branches)
- Restructure data flow (same inputs/outputs, different internal steps)

If the user's request mixes refactoring with feature changes ("while you're in there, also add X"), handle them as separate commits.

---

## Refactoring process

### Make one change at a time

Each step is a single, coherent transformation. After each step:
1. Run the tests
2. If they pass: commit the step (or stage it as a logical unit)
3. If they fail: revert the step and investigate before proceeding

```bash
# After each step
pnpm test path/to/relevant.test.ts

# If tests pass, stage the change
git add path/to/modified/file.ts

# If tests fail, revert and investigate
git diff  # understand what changed
git restore path/to/modified/file.ts  # revert if needed
```

### Step ordering for common refactors

**Extracting a function:**
1. Identify the code block to extract
2. Create the new function with the extracted code (tests pass — logic unchanged)
3. Replace the original code with a call to the new function (tests pass — same behavior)
4. Add tests for the new function directly if it's non-trivial

**Renaming:**
1. Add the new name as an alias (or use IDE rename across all references)
2. Verify tests pass
3. Remove the old name

**Removing duplication:**
1. Create a shared function that captures the common behavior
2. Tests pass for the new function directly
3. Replace one call site — tests pass
4. Replace the next call site — tests pass
5. Repeat until all duplication is removed

**Simplifying conditionals:**
1. One branch at a time
2. Test after each branch simplification
3. If a simplification breaks a test: the test was testing valid behavior — the original logic was intentional

---

## What not to change during a refactor

- **Don't change what the code does** — not even to fix an existing bug. Log the bug and fix it in a separate commit.
- **Don't change the public API** unless that's explicitly the goal, and callers have been updated
- **Don't add new features** — even "obvious" improvements belong in a feature commit
- **Don't change tests to make them pass** after a refactor — a test that now fails after a "pure refactor" means you changed behavior. Fix the code, not the test.
- **Don't mix refactoring and formatting** in the same commit — a massive auto-format makes the behavior change invisible in the diff

---

## When to stop

Stop the refactor and get explicit confirmation if:
- The tests can't be run (missing test infrastructure, broken environment)
- The scope has expanded significantly beyond what was asked
- You find a bug in the original code that the refactor would change — log it and ask how to proceed
- The refactor would require changing the public API that other teams or external consumers depend on

---

## Commit format

Refactoring commits use the `refactor:` prefix:

```
refactor: extract validation logic into parseUserInput helper

refactor: remove duplication in order processing pipeline

refactor: simplify auth middleware conditional chain
```

If behavior changed at all — even a bug fix — it's not `refactor:`, it's `fix:`.
