# Coding Style Rules

## Core Principles

### Immutability
Always create new objects — never mutate arguments, external state, or objects passed in. This prevents hidden side effects and makes behavior predictable.

```typescript
// Bad
function addTag(user: User, tag: string) {
  user.tags.push(tag)  // mutates the argument
}

// Good
function addTag(user: User, tag: string): User {
  return { ...user, tags: [...user.tags, tag] }
}
```

### KISS (Keep It Simple)
Prefer the straightforward solution over the clever one. Code is read far more often than it's written. Optimize for comprehension first, performance only after profiling.

### DRY (Don't Repeat Yourself)
Extract logic that appears in two or more places into a shared function. But don't extract prematurely — three similar lines in different contexts is better than one abstraction that fits none of them perfectly.

### Search before you write
Before implementing any new function, component, or utility: search the codebase for an existing implementation. This is the single most effective way to prevent the codebase from accumulating redundant code — especially when AI tools are involved in development.

### YAGNI (You Aren't Gonna Need It)
Build only what the current requirement needs. No speculative abstractions, no "we might need this later" parameters, no feature flags for features that don't exist yet.

---

## Structure

### File size
- Target: 200–400 lines
- Hard limit: 800 lines
- If a file is growing past 400 lines, it probably has more than one responsibility — split it

### Organization
- Organize by **feature/domain**, not by file type
- Bad: `models/`, `controllers/`, `views/` all containing every feature's files
- Good: `users/`, `payments/`, `notifications/` each containing their model, controller, and view

### One responsibility per file
- One React component per file (named identically to the file)
- One class or service per file in backend code
- Utility files are the exception — group small, related pure functions

---

## Naming

| Type | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `getUserById`, `isLoading` |
| Classes, types, interfaces, components | `PascalCase` | `UserService`, `AuthProvider` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Files (non-component) | `kebab-case` | `user-service.ts`, `auth-utils.ts` |
| Files (components) | `PascalCase` | `UserCard.tsx`, `AuthModal.tsx` |
| Booleans | `is`/`has`/`should`/`can` prefix | `isAuthenticated`, `hasPermission` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleUserClick` |
| Async functions | name reflects result, not the async nature | `getUser`, not `fetchUserAsync` |

### What to avoid
- Generic names: `data`, `result`, `obj`, `temp`, `item`, `value` — name what it actually is
- Misleading abbreviations: `usr`, `msg`, `btn` — spell it out
- Type suffixes in names: `userArray`, `configObject` — the type tells you this
- Negative booleans: `isNotEnabled` — use `isDisabled` instead

---

## Functions

### Size
- Target under 20 lines
- Hard limit: 50 lines
- If a function needs a comment to explain what a section does, that section is a candidate for extraction

### Single responsibility
A function should do one thing. "Validate input AND save to DB AND send notification" is three functions.

### Parameters
- 3 parameters maximum — if you need more, pass an options object
- Boolean parameters are often a sign that a function should be two functions
- Avoid output parameters — return new values instead of mutating arguments

### Return early
Use guard clauses to reduce nesting:

```typescript
// Nested (bad)
function processOrder(order: Order) {
  if (order.isValid) {
    if (order.hasInventory) {
      if (order.paymentCleared) {
        return fulfillOrder(order)
      }
    }
  }
  return null
}

// Guard clauses (good)
function processOrder(order: Order) {
  if (!order.isValid) return null
  if (!order.hasInventory) return null
  if (!order.paymentCleared) return null
  return fulfillOrder(order)
}
```

---

## Error Handling

### Handle explicitly
Never silently swallow errors. Every catch block must either handle the error, re-throw it with context, or log it.

```typescript
// Bad
try {
  await saveUser(user)
} catch (e) {
  // silent — the error is gone
}

// Good
try {
  await saveUser(user)
} catch (error) {
  logger.error('Failed to save user', { userId: user.id, error })
  throw new DatabaseError('User save failed', { cause: error })
}
```

### Error context
When re-throwing, add context. The caller shouldn't need to know the implementation details to understand what failed.

### User-facing vs. internal errors
- Internal errors (with stack traces, DB errors): log server-side, never send to client
- User-facing errors: clear, actionable messages that don't expose implementation details

---

## Comments

Write comments only when the **why** is non-obvious. Code should express the what and how through clear naming.

```typescript
// Bad: restates what the code already says
// Get the user by their ID
const user = await getUserById(id)

// Good: explains a non-obvious constraint
// Skip validation for service accounts — they have pre-validated tokens
if (user.type === 'service') return user
```

Never write:
- TODO comments without a ticket reference
- Commented-out code
- Docstrings that describe what parameters are (the types already do this)

---

## Imports

Order: external packages → internal aliases → relative paths. Separate each group with a blank line.

```typescript
import { z } from 'zod'
import { useState } from 'react'

import { db } from '@/lib/db'
import { UserSchema } from '@/types'

import { formatDate } from '../utils'
```

No circular dependencies. If you feel the need for one, the abstraction layer is wrong.

---

## Code Smells to Eliminate

| Smell | What to do instead |
|---|---|
| Nesting beyond 4 levels | Return early, extract functions |
| Magic numbers (`if (status === 3)`) | Named constant (`if (status === ORDER_STATUS.SHIPPED)`) |
| Long parameter lists (4+) | Options object |
| Boolean parameters | Two separate functions |
| God objects / God functions | Split by responsibility |
| Primitive obsession (raw strings for emails, IDs) | Branded types or value objects |
| Dead code | Delete it — git history preserves it |

---

## Reuse and Modularity

This section is specifically about preventing redundant code accumulation — a problem that accelerates when AI coding tools are involved, because agents generate plausible-looking code without always knowing what already exists.

### Before writing anything new: search first

Run these checks before implementing any new function, hook, component, utility, or service:

```bash
# Does this function already exist anywhere?
grep -r "keyword\|alternateKeyword" src/ --include="*.ts" --include="*.tsx" -l

# What utilities already exist?
ls src/lib/ src/utils/ src/helpers/

# Has this type already been defined?
grep -rn "interface.*TypeName\|type TypeName" src/

# Is there an existing component that does something similar?
find src/components -name "*.tsx" | xargs grep -l "keyword"
```

If you find something that partially fits, extend or generalize it rather than creating a parallel version.

### Where code belongs

| Code type | Where it lives |
|---|---|
| Pure utility functions (no framework deps) | `src/lib/` or `src/utils/` |
| Shared React hooks | `src/hooks/` |
| Shared UI components | `src/components/ui/` |
| Feature-specific logic | `src/features/<name>/` or `src/<domain>/` |
| Types used in 2+ places | `src/types/` |
| Single-use helpers | Same file as the caller |

When you write a utility and put it inline in a feature file, it becomes invisible to the next person (or agent) looking for reusable code. Shared code must live in shared directories to be discoverable.

### The rule of two

If logic appears in two places, extract it. Not one — two. A single use case doesn't yet define the right abstraction. Two uses reveal the pattern.

When extracting:
1. Write the shared function in `src/lib/` or `src/utils/`
2. Replace both original sites with calls to the shared function
3. Verify tests pass at both call sites

### When NOT to abstract

Premature abstraction is as harmful as duplication. Don't extract when:
- The two pieces of code are similar but solve different problems — coincidental similarity, not structural duplication
- The abstraction would require a complex parameter to handle both cases — that's a sign the use cases should stay separate
- The shared function would be used in only one place — leave it inline

**The test:** can you explain the shared function's purpose without reference to a specific caller? If yes, extract. If the explanation is "it does X for the user flow and Y for the admin flow," keep them separate.

### Modularity checklist for new features

Before opening a PR for any new feature:

- [ ] Searched for existing utilities that could be reused or extended
- [ ] New utility functions are in `src/lib/` or `src/utils/`, not inline
- [ ] No new types that duplicate existing types
- [ ] No new components that duplicate existing components in `src/components/ui/`
- [ ] Logic used in 2+ places has been extracted to a shared location

### CI enforcement: duplication detection

For codebases where duplication is a significant concern, add `jscpd` to CI to detect copy-pasted blocks:

```bash
# Install
npm install --save-dev jscpd

# Run — fails if any duplicated block exceeds 20 lines
npx jscpd src/ --min-lines 20 --reporters console --blame
```

Add to your CI pipeline after the build step. A 20-line threshold catches meaningful duplication while ignoring coincidental similarity in short utility functions.
