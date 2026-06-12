# CLAUDE.md — Full-Stack Web (Next.js / TypeScript)

## Project Overview

<!-- FILL IN -->

**Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL
**Status:** <!-- Active development / Production / Maintenance -->

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | <!-- NextAuth.js / Clerk / Auth.js --> |
| API Layer | <!-- tRPC / REST / GraphQL --> |
| State | TanStack Query (server), Zustand (client) |
| Testing | Vitest, React Testing Library, Playwright |
| Hosting | <!-- Vercel / Railway / AWS --> |

---

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Auth route group
│   ├── (dashboard)/     # Protected route group
│   ├── api/             # API route handlers
│   └── layout.tsx       # Root layout
├── components/
│   ├── ui/              # Primitives (Button, Input, Modal — no business logic)
│   └── features/        # Feature-scoped components
├── lib/
│   ├── db.ts            # Prisma client singleton
│   ├── auth.ts          # Auth config
│   └── utils.ts         # Pure utility functions
├── server/
│   ├── db/              # Schema, migrations, seed
│   └── api/             # Server-side API logic
├── hooks/               # Custom React hooks
└── types/               # Shared TypeScript types
```

---

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm test             # Run Vitest unit/integration tests
pnpm test:e2e         # Run Playwright e2e tests
pnpm typecheck        # Run tsc --noEmit
pnpm lint             # ESLint
pnpm db:migrate       # Apply Prisma migrations
pnpm db:generate      # Regenerate Prisma client
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed development data
```

---

## Architecture & Key Patterns

### Request lifecycle
```
Browser → Next.js Server Component → Server Action / Route Handler → Prisma → PostgreSQL
                                   → tRPC (if applicable)
```

### Data fetching rules
- **Server Components** fetch data directly — no API call needed for server-rendered content
- **Client Components** use TanStack Query for server state, never `useEffect` + `fetch`
- **Mutations** use Server Actions (preferred) or tRPC mutations
- Never fetch in `useEffect` — it causes waterfall requests and race conditions

### Component rules
- `ui/` components are dumb — they receive props and render, no data fetching, no business logic
- `features/` components may contain business logic and data fetching
- Server Components by default; add `"use client"` only when you need interactivity or browser APIs
- Keep Client Component boundaries as low in the tree as possible

### Database rules
- All DB access goes through `lib/db.ts` — never import Prisma directly
- Use transactions for operations that touch multiple tables
- Never expose raw Prisma errors to clients — map to user-friendly messages

### Authentication
- All routes under `(dashboard)/` require authentication — enforced in middleware
- `session` is available in Server Components via `getServerSession(authOptions)`
- Never trust client-side auth state for permission checks — always verify server-side

### TypeScript rules
- `strict: true` is non-negotiable — never use `any`, use `unknown` and narrow
- Prefer `type` over `interface` for object shapes unless you need extension/merging
- All API response types must be explicitly defined — no `any` return types
- Use Zod for runtime validation at API boundaries and form inputs

---

## Testing Requirements

- **Unit tests** (`*.test.ts`): Pure functions, utilities, server actions
- **Integration tests** (`*.test.ts`): API routes with real DB (test DB, not mocks)
- **E2e tests** (`*.spec.ts`): Critical flows — sign up, core user journey, checkout (if applicable)

### Test database
Use a separate test database. Set `DATABASE_URL` in `.env.test`. Never run tests against the development or production database.

### Mocking policy
- **Mock** external APIs (Stripe, SendGrid, etc.) in unit/integration tests
- **Never mock** the database in integration tests — test against a real schema
- **Never mock** business logic — if you need to, the logic is too tangled

---

## Security Requirements

- All form inputs validated with Zod before any DB operation
- All API routes check authentication before processing
- `NEXTAUTH_SECRET` must be a randomly generated 32+ byte secret
- Never log request bodies in production — they may contain PII or secrets
- Use `httpOnly` cookies for session tokens — never expose to JavaScript
- Content Security Policy headers configured in `next.config.js`
- Never use `dangerouslySetInnerHTML` with user-generated content

---

## Performance Guidelines

- Use `next/image` for all images — never raw `<img>` tags
- Use `next/font` for fonts — eliminates FOUT and external requests
- Code-split large features with `dynamic(() => import(...), { ssr: false })`
- Use `React.memo` sparingly — profile before memoizing
- Database queries: always include `select` to limit returned columns on large tables
- Use `Promise.all` for parallel independent queries — never sequential awaits
- Add indexes to columns used in `WHERE` clauses and foreign keys

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_TEST=postgresql://...

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## AI Agent Behavior

- Run `pnpm typecheck` after every code change — TypeScript errors are bugs
- Use the `planner` agent before implementing features that touch 3+ files
- After any database schema change, run `pnpm db:generate` to regenerate types
- For Prisma query issues, check `lib/db.ts` first — connection and middleware are configured there
- App Router and Pages Router have different patterns — this project uses App Router exclusively
