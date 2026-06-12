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
