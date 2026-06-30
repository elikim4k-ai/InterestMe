# InterestMe ✦

**Discover people, not profiles.** InterestMe turns networking events into genuine human connections through shared interests, projects, and goals — powered by AI matching.

## Tech Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + pgvector) · Prisma · React Query · Framer Motion · OpenAI

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
   - `DATABASE_URL`, `DIRECT_URL` (Settings → Database → Connection string)
   - `OPENAI_API_KEY`

### 3. Apply the database schema

```bash
npm run db:push                          # Create tables from Prisma schema
# Then run supabase/migrations/0001_auth_triggers_and_rls.sql
# in the Supabase SQL editor (sets up auth triggers + RLS)
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
- **Phase 3** AI matching, recommendations, gamification, realtime
- **Phase 4** Knowledge graph, mind map, analytics
- **Phase 5** Polish, performance, testing, deployment
