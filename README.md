# InterestMe ✦

**Discover people, not profiles.** InterestMe turns networking events into genuine human connections through shared interests, projects, and goals — powered by AI matching.

## Tech Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + pgvector) · Prisma · React Query · Framer Motion · OpenAI

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Getting Started

### 1. Install dependencies

Prerequisites: Git and a Node.js runtime compatible with the locked Next.js
version. Use Node.js 22 LTS for a consistent starting point.

```bash
git clone https://github.com/elikim4k-ai/InterestMe.git
cd InterestMe
npm ci
npm run db:generate
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
   - `DATABASE_URL`, `DIRECT_URL` (Settings → Database → Connection string)
   - `SUPABASE_SERVICE_ROLE_KEY` for server operations
   - Optional: `GEMINI_API_KEY` or `OPENAI_API_KEY`; no provider key selects the deterministic fallback

### 3. Apply the database schema

```bash
npm run db:push                          # Create tables from Prisma schema
# Then apply the SQL files in supabase/migrations/ in numeric order
# in the Supabase SQL editor against a fresh development database.
# These configure auth, RLS, matching, guests, and messaging.
```

### 4. Configure OAuth (optional)

In Supabase Dashboard → Authentication → Providers, enable Google / LinkedIn
and add `http://localhost:3000/api/auth/callback` as a redirect URL.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm test` | Run Vitest unit tests once |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run type-check` | TypeScript check |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/              # Routes (auth, dashboard, public event pages, API)
├── components/       # ui/ · layout/ · forms/ · profile/ · events/ · shared/
├── lib/
│   ├── actions/      # Server Actions (profile, event) — validated mutations
│   ├── validations/  # Zod schemas (single source of truth)
│   ├── supabase/     # Client/server/proxy Supabase setup
│   ├── ai/           # AI layer (Phase 3+)
│   └── utils/        # Helpers
├── hooks/ · stores/ · types/
└── proxy.ts          # Route protection (Next.js 16 middleware)
```

## Development Phases

- **Phase 1** ✅ Architecture, auth, schema, core layout
- **Phase 2** ✅ Profiles, interests, events, questions, QR codes, join flow
- **Phase 3** AI matching, recommendations, gamification, realtime (see source and tests for implemented parts)
- **Phase 4** Knowledge graph, mind map, analytics
- **Phase 5** Polish, performance, testing, deployment

## Tests and reproducible checks

```bash
npm test
npm run db:generate
npm run type-check
npm run lint
npm run build
```

Vitest uses the Node environment and includes `src/**/*.test.ts`: scoring,
provider fallback, insights, achievements, and knowledge graph behavior.
Run with provider keys unset for deterministic fallback checks. These unit
tests do not validate hosted Supabase auth, database policies, OAuth, or email.
Type checking and builds require the generated Prisma client. Database-backed
checks additionally require the configured development Supabase project.
The production build also requires Supabase URL/key environment variables:
without them, signup prerendering fails. A credential-free checkout can run
the unit tests, but it cannot complete the production build as currently written.

Review status (28 October 2026, Node 24.18.0): 42 unit tests and generated-client
type checking passed. ESLint reported five errors and three warnings; these
remain unresolved. A build without Supabase configuration failed at signup
prerendering after successful compilation. Do not infer a passing release
check from the commands listed here.

For an end-to-end manual check, create a test account, complete a profile,
create an event, and join it using a second test account. Verify that the
attendee can see the event and expected permitted co-attendees. Record the
fixture profiles, event configuration, applied migration filenames, provider
mode, commit, Node/npm versions, and exact commands. Keep service-role keys
server-side. No measured matching-quality claim follows from unit-test success.
