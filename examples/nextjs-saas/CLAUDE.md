# CLAUDE.md — Next.js SaaS Starter

## Project Overview

A multi-tenant SaaS boilerplate built with Next.js 14 App Router. Handles authentication, team management, billing, and a basic dashboard. Used as a starting point for B2B SaaS products.

**Status:** Active development
**Team:** 2–5 engineers
**Primary language:** TypeScript

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Email + Google OAuth) |
| API | Server Actions + tRPC for client-heavy flows |
| Payments | Stripe (subscriptions) |
| Email | Resend |
| State | TanStack Query, Zustand |
| Testing | Vitest, Playwright |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Unauthenticated: /login, /signup, /verify
│   ├── (dashboard)/          # Authenticated: /dashboard/*, /settings/*
│   │   ├── layout.tsx        # Auth guard + sidebar layout
│   │   ├── dashboard/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/             # NextAuth route
│   │   ├── trpc/             # tRPC route handler
│   │   └── webhooks/
│   │       └── stripe/       # Stripe webhook handler
│   └── layout.tsx            # Root layout (providers)
├── components/
│   ├── ui/                   # shadcn/ui primitives (do not modify)
│   └── features/             # App-specific components
│       ├── auth/
│       ├── billing/
│       ├── dashboard/
│       └── settings/
├── lib/
│   ├── db.ts                 # Prisma singleton — ONLY import DB from here
│   ├── auth.ts               # NextAuth config
│   ├── stripe.ts             # Stripe client singleton
│   └── email.ts              # Resend client
├── server/
│   ├── api/
│   │   ├── root.ts           # tRPC root router — add new routers here
│   │   └── routers/          # Feature-scoped tRPC routers
│   └── db/
│       ├── schema.prisma
│       └── seed.ts
└── types/
    └── index.ts
```

---

## Development Commands

```bash
pnpm install                    # Install dependencies
pnpm dev                        # Start dev server (localhost:3000)
pnpm build                      # Production build
pnpm test                       # Vitest unit + integration tests
pnpm test:e2e                   # Playwright e2e tests
pnpm typecheck                  # tsc --noEmit
pnpm lint                       # ESLint
pnpm db:migrate                 # Apply pending Prisma migrations
pnpm db:generate                # Regenerate Prisma client after schema change
pnpm db:studio                  # Open Prisma Studio
pnpm db:seed                    # Seed dev data (creates demo org + user)
pnpm stripe:listen              # Forward Stripe webhooks to localhost
```

---

## Architecture & Key Patterns

### Multi-tenancy
Every piece of user data is scoped to an `Organization`. All queries **must** include `organizationId` in the WHERE clause. Never query across organizations.

```typescript
// Correct — scoped to org
const members = await db.user.findMany({
  where: { organizationId: session.user.organizationId }
})

// Wrong — returns data across all orgs
const members = await db.user.findMany()
```

### Auth flow
1. User signs in via NextAuth (email magic link or Google)
2. Session contains `userId`, `organizationId`, and `role`
3. Middleware in `(dashboard)/layout.tsx` enforces auth
4. tRPC procedures access session via `ctx.session`
5. Server Actions call `getServerSession(authOptions)` before any data access

### Billing model
- Plans: `FREE`, `PRO`, `ENTERPRISE`
- Billing is per-organization, not per-user
- Stripe webhooks in `app/api/webhooks/stripe/` handle all subscription events
- Current plan is stored in `Organization.plan` — sync'd by the webhook handler
- Feature gating: use `canAccess(session, feature)` from `lib/access.ts`

### Important files
- `lib/db.ts` — Prisma singleton. Never `import { PrismaClient }` elsewhere
- `lib/auth.ts` — NextAuth config. Session shape is defined here
- `server/api/root.ts` — tRPC router registry. Add new routers here
- `app/api/webhooks/stripe/route.ts` — Stripe event handler. Critical path — test before touching
- `middleware.ts` — Route protection. Runs on every request matching `(dashboard)/`

---

## Testing Requirements

- All Stripe webhook handlers must have integration tests with real Stripe event payloads
- Auth flows: test with Playwright (e2e) — unit tests don't catch session edge cases
- Database: use a separate Supabase project (or local Docker) for tests — never the dev DB
- Multi-tenancy: every new query must have a test that confirms cross-org data is not accessible

### Test fixtures
```bash
pnpm db:seed          # Creates: org "Acme Corp", admin user admin@acme.test, member user@acme.test
```

---

## Security Requirements

- Stripe webhook signatures **must** be verified before processing any event — see existing handler for the pattern
- Never expose `organizationId` manipulation to clients — always derive from the session
- `NEXTAUTH_SECRET` must be 32+ bytes of random data
- Resend API key has send-only scope — if you add read operations, use a separate key
- `STRIPE_WEBHOOK_SECRET` is environment-specific — dev and prod have different secrets

---

## Stripe Integration Notes

- Use `pnpm stripe:listen` to forward webhooks during development
- The webhook handler at `app/api/webhooks/stripe/route.ts` is the single source of truth for subscription state — do not update `Organization.plan` anywhere else
- Test webhook events with the Stripe CLI: `stripe trigger customer.subscription.updated`
- Stripe customer ID is stored in `Organization.stripeCustomerId` — never create a second customer for the same org

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## AI Agent Behavior

- Run `pnpm typecheck` after every change — TypeScript errors here are often runtime crashes in production
- Use the `planner` agent before any change that touches auth, billing, or multi-tenancy logic
- After schema changes: `pnpm db:generate` must run before any code that uses the new fields
- Stripe and NextAuth have version-specific APIs — check the installed version before suggesting patterns
- `(dashboard)/` layout handles auth — don't add separate auth checks to individual pages unless the page has additional permission requirements beyond basic authentication
