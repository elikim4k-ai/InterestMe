# InterestMe — Architecture Document

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 16 App Router + TypeScript | RSC for performance, streaming, file-based routing |
| Styling | Tailwind v4 + shadcn/ui (hand-rolled) | Design system with full control, no class conflicts |
| Animation | Framer Motion | Production-quality motion primitives |
| State | Zustand (client) + React Query (server) | Separate concerns; no Redux complexity |
| Database | Supabase (Postgres + pgvector) | Hosted Postgres with RLS, realtime, auth, storage |
| ORM | Prisma | Type-safe migrations and queries |
| Auth | Supabase Auth | OAuth (Google, LinkedIn), email/password, SSR cookies |
| AI | OpenAI (abstracted behind `src/lib/ai/`) | Embeddings, matching, conversation starters |
| Deployment | Vercel | Edge network, preview deployments, env management |

## Directory Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup, onboarding — no sidebar
│   ├── (dashboard)/      # Protected pages — with sidebar + mobile nav
│   ├── api/              # API routes (auth callback, etc.)
│   └── event/[slug]/     # Public event join page
├── components/
│   ├── ui/               # Primitive UI components (Button, Input, etc.)
│   ├── layout/           # Sidebar, MobileNav, TopBar
│   ├── forms/            # Login, Signup, Onboarding wizard
│   ├── profile/          # Profile display, interest grid
│   ├── events/           # Event cards, creation form, QR display
│   └── shared/           # Providers, ErrorBoundary, Loading states
├── lib/
│   ├── supabase/         # client.ts, server.ts, middleware.ts
│   ├── ai/               # embeddings.ts, matching.ts, starters.ts
│   └── utils/            # cn(), slugify(), formatters
├── hooks/                # useUser(), useProfile(), useEvent()
├── stores/               # Zustand stores (ui, event session)
└── types/                # database.ts, index.ts
```

## Data Model Overview

```
users (Supabase Auth)
  └── profiles (1:1) — display info, embedding vector
        ├── profile_interests (M:M) → interests
        ├── projects
        ├── goals
        └── knowledge_nodes → knowledge_edges

organizations
  └── events
        ├── event_attendees (users × events)
        │     └── event_answers
        └── event_questions
              └── event_answers

connections (users × users)
recommendations (event-scoped AI matches)
achievements / user_achievements (gamification)
notifications
privacy_settings (per-user)
activity_logs (audit trail)
```

## Auth Flow

1. User signs up / OAuth → Supabase Auth creates `auth.users` record
2. Supabase trigger creates `public.users` + `public.profiles` row
3. `proxy.ts` checks session on every request
4. If authenticated but `onboarding_done = false` → redirect `/onboarding`
5. Dashboard layout server component fetches profile for sidebar

## AI Architecture

All AI lives in `src/lib/ai/` behind a clean interface so models can swap:

```typescript
// src/lib/ai/embeddings.ts
export async function generateEmbedding(text: string): Promise<number[]>
export async function updateProfileEmbedding(profileId: string): Promise<void>

// src/lib/ai/matching.ts
export async function getEventMatches(userId: string, eventId: string): Promise<Match[]>

// src/lib/ai/starters.ts
export async function generateConversationStarters(userA: Profile, userB: Profile): Promise<string[]>
```

Phase 1: cosine similarity on pgvector embeddings
Phase 2: weighted scoring (interests + goals + projects)
Phase 3: agent-based reasoning with conversation history

## Multi-Tenancy

Every tenant-scoped entity carries `organization_id`. Supabase RLS policies enforce:
- Users can only read/write their own data
- Event data is scoped to event attendees
- Organization admins can manage their org's events

## Performance Strategy

- Server Components for all data-fetching pages (no client JS for static content)
- React Query for client-side data that updates frequently
- `pgvector` index (`ivfflat`) for fast similarity search at scale
- Supabase Realtime for live event attendee updates and notifications
- Image optimization via Next.js `<Image>` + Supabase Storage CDN

## Security

- Row-Level Security on all tables (Supabase)
- No direct database credentials exposed to client
- Input validation at every API boundary (Zod schemas)
- OAuth state parameter validates redirect URLs
- Rate limiting via Supabase edge function middleware (Phase 2)
- GDPR: privacy settings model, data export endpoint (Phase 4)

## Development Phases

| Phase | Focus |
|---|---|
| 1 ✅ | Architecture, auth, core layout, database schema |
| 2 ✅ | Profiles, interests, events, questions, QR, join flow |
| 3 ✅ | AI matching, recommendations, gamification, realtime |
| 4 ✅ | Knowledge graph + 3D mind map, analytics, AI insights/RAG |
| 5 ✅ | Testing (Vitest), polish, SEO, deployment (Vercel) |

## Testing (Phase 5)

`npm test` runs the Vitest suite (42 tests) over the **pure, deterministic**
core — no DB or network needed:

- `ai/scoring.test.ts` — cosine similarity, blended match score, ranking
- `knowledge/builder.test.ts` — graph shape, no dangling links, truncation
- `gamification/achievements.test.ts` — unlock thresholds, catalog integrity
- `ai/provider.test.ts` — deterministic NullProvider embeddings (dimension,
  normalization, similarity ordering)
- `ai/insights.test.ts` — RAG fallback grounding

This is why the AI layer was designed pure/deterministic from Phase 3: match
quality is verifiable without an API key. The suite already caught a real crash
(`truncate()` on malformed rows) and a prod-build blocker (`new URL("")`).

Also shipped: global error boundary (`app/error.tsx`), custom 404
(`app/not-found.tsx`), dashboard loading skeleton, and full SEO metadata
(metadataBase, OpenGraph, Twitter card, robots).

## Mutation Layer (Phase 2)

All writes go through **Server Actions** in `src/lib/actions/`, never ad-hoc
client Supabase calls. This gives us:

- One validated path per mutation (Zod schemas in `src/lib/validations/`)
- Type-safe `ActionResult<T>` discriminated union return (`{ success, data | error }`)
- `getAuthedContext()` / `getAuthedUser()` helpers resolve user + profile once
- Automatic `revalidatePath()` cache invalidation
- RLS as the security backstop — actions assume but don't rely on auth

```
src/lib/
├── actions/
│   ├── helpers.ts    # getAuthedContext, ok(), fail(), ActionResult<T>
│   ├── profile.ts    # updateProfile, setInterests, setGoals, addProject, completeOnboarding
│   └── event.ts      # createEvent, joinEvent, checkInToEvent, submitAnswers, deleteEvent
└── validations/      # profile.ts, event.ts  (Zod — shared client + server)
```

## Database Setup Order

1. `prisma db push` — creates all tables from `prisma/schema.prisma`
2. Run `supabase/migrations/0001_auth_triggers_and_rls.sql` — this:
   - Creates `handle_new_user` trigger → auto-creates `users` + `profiles` +
     `privacy_settings` rows when someone signs up (critical: actions assume a
     profile row exists)
   - Enables RLS on every tenant table with per-table policies
   - Adds `is_event_attendee()` and `profile_owner()` security-definer helpers

## Event Questions (Typed)

Questions are discriminated by `QuestionType` (TEXT, MULTILINE, SELECT,
MULTI_SELECT, SCALE). The organizer's builder and the attendee's renderer both
switch on type. MULTI_SELECT answers are stored as `|||`-joined strings (will
migrate to JSON array column if filtering needs grow).

## AI Layer (Phase 3)

Business logic never imports OpenAI. It depends on two stable interfaces so we
can evolve embeddings → agents without touching features.

```
src/lib/ai/
├── provider.ts    # AIProvider: embed() + complete(). OpenAIProvider + NullProvider.
│                  #   NullProvider = deterministic hash embeddings + empty completions,
│                  #   so the app runs fully without an API key (dev/CI/tests).
├── scoring.ts     # PURE, deterministic blended score. No I/O. Unit-testable.
│                  #   0.4 semantic + 0.3 interest overlap + 0.2 goal align + 0.1 serendipity
├── embeddings.ts  # Profile → canonical text → vector → pgvector column
├── matching.ts    # MatchEngine interface. EmbeddingMatchEngine today;
│                  #   AgentMatchEngine later implements the SAME interface.
└── starters.ts    # Conversation starters (LLM + deterministic template fallback)
```

**Why blended scoring, not raw cosine:** raw embedding similarity over-rewards
people who *describe* themselves alike. We mix in explicit signals (shared
interests via Jaccard, goal alignment, and a serendipity term that peaks at
moderate overlap to encourage cross-pollination). Fully deterministic → testable
without any API key.

**Embedding lifecycle:** refreshed (best-effort, non-blocking) after onboarding
completion and after answering event questions — the two moments a person's
match profile materially changes. Stored in `profiles.embedding_vector`
(pgvector, ivfflat cosine index).

**Recommendations are persisted**, not recomputed per request — written to the
`recommendations` table, so they're stable, dismissable, and cheap to read.
`getMatchEngine()` / `getAIProvider()` are swap points.

## Gamification

Achievement catalog lives in code (`src/lib/gamification/achievements.ts`) — the
`key` is the contract, seeded into the `achievements` table by migration 0002.
`evaluateAchievements(stats)` is pure; `syncAchievements()` unlocks newly-earned
badges idempotently and is fired (best-effort) from join/check-in/discover flows.

## Realtime

`useEventPresence(eventId)` uses Supabase Realtime **presence** for a live
"N here now" count on the discover feed. `event_attendees` + `recommendations`
are added to the `supabase_realtime` publication for future live updates.

## Living Knowledge Graph (Phase 4)

A personal, branching mind map (Obsidian-style) derived from everything the user
already has: `You (root) → category hubs → leaf nodes` (interests, projects,
goals, events attended, connections).

```
src/lib/knowledge/
├── types.ts     # GraphNode/GraphLink/KnowledgeGraph + per-kind color tokens. Shared contract.
└── builder.ts   # buildKnowledgeGraph(source) — PURE root→category→leaf assembly.

src/lib/actions/knowledge.ts   # getMyKnowledgeGraph() — gathers profile/events/connections

src/components/mindmap/
├── force-graph-3d.tsx  # 3D WebGL graph (react-force-graph-3d / Three.js)
├── node-inspector.tsx  # Click → glassmorphic detail panel
└── mind-map.tsx        # Shell: revolve toggle, legend, hints
```

**Rendering choice:** `react-force-graph-3d` (Three.js + d3-force) — the standard
for WebGL knowledge graphs. **Dynamically imported with `ssr: false`** (WebGL is
browser-only); the wrapper erases the component generic, so node/link objects are
narrowed at the boundary via `asGNode()`/`endpointId()` helpers.

**Interactions:** auto-revolving camera orbit (toggleable), click-to-inspect with
camera fly-to, hover neighbor highlighting (dims non-adjacent nodes/links), drag
+ scroll-zoom, custom Three.js node objects (glowing sphere + halo + billboarded
text sprite), color-coded by node kind.

**Why derive (not just persist):** the graph is computed fresh from source data so
it's always current. `knowledge_nodes`/`knowledge_edges` tables exist for the next
step — persisting AI-extracted nodes (topics/skills inferred from answers) and
cross-user edges for RAG traversal.

## Analytics & AI Insights (Phase 4)

```
src/lib/actions/analytics.ts   # getPersonalAnalytics() + getEventAnalytics(eventId)
src/lib/ai/insights.ts         # generateGraphInsights() — RAG over the knowledge graph
src/components/analytics/       # charts.tsx (BarList/MiniBars/StatTile — zero-dep), graph-insights.tsx
```

- **Personal analytics** (`/analytics`): connections, events, XP, achievements,
  weekly activity, your network's aggregate interests, where you connect.
- **Event analytics** (organizer manage page): check-in rate, answers submitted,
  connections made, top interests in the room.
- **Charts are dependency-free** — custom SVG/CSS + Framer Motion. No chart lib
  to keep the bundle lean; swap for Recharts only if interactivity demands it.

**AI insights = lightweight RAG.** The knowledge graph *is* the retrieval context:
`generateGraphInsights()` serializes it into a compact prompt → summary + grounded
suggestions. `askMyGraph(question)` answers free-form questions over the same
context. Both run through the shared `AIProvider`, with deterministic, still-
grounded fallbacks when no `OPENAI_API_KEY` is set. Upgrades to vector-RAG/agents
without changing callers.

## Viral Join Loop

`/event/[slug]` is a **public** route (outside the auth group). Flow:
logged-out preview → sign in/up with `redirectTo` → onboarding if needed →
join → answer questions → check in → `/discover`. QR codes (generated in
`src/lib/qr.ts`) encode this URL.
