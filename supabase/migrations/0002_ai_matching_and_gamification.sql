-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Phase 3: AI matching, recommendations & gamification
-- Adds the policies + seed data + vector index the Phase 3 features rely on.
-- Run AFTER 0001_auth_triggers_and_rls.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Vector similarity index (cosine) ─────────────────────────────────────
-- ivfflat needs ANALYZE after data grows; lists=100 is a sane starting point.
create index if not exists profiles_embedding_idx
  on public.profiles
  using ivfflat (embedding_vector extensions.vector_cosine_ops)
  with (lists = 100);

-- ─── 2. Recommendations: allow the owner to write their own rows ─────────────
-- 0001 only granted select/update. The match engine upserts as the user.
drop policy if exists "recommendations_insert_self" on public.recommendations;
create policy "recommendations_insert_self" on public.recommendations
  for insert with check (user_id = auth.uid());

drop policy if exists "recommendations_update_owner" on public.recommendations;
create policy "recommendations_update_owner" on public.recommendations
  for update using (user_id = auth.uid());

-- ─── 3. Notifications: allow inserting a notification FOR another user ────────
-- Connection requests notify the receiver. Keep it scoped: the sender must be
-- the authenticated user (enforced via the connection existing). For v1 we
-- allow authenticated inserts; tighten with a trigger in Phase 4.
drop policy if exists "notifications_insert_authed" on public.notifications;
create policy "notifications_insert_authed" on public.notifications
  for insert with check (auth.role() = 'authenticated');

-- ─── 4. Gamification RLS ─────────────────────────────────────────────────────
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- Achievement catalog is world-readable
drop policy if exists "achievements_select_all" on public.achievements;
create policy "achievements_select_all" on public.achievements
  for select using (true);

-- A user reads their own unlocks; inserts only for themselves
drop policy if exists "user_achievements_select_self" on public.user_achievements;
create policy "user_achievements_select_self" on public.user_achievements
  for select using (user_id = auth.uid());

drop policy if exists "user_achievements_insert_self" on public.user_achievements;
create policy "user_achievements_insert_self" on public.user_achievements
  for insert with check (user_id = auth.uid());

-- ─── 5. Seed the achievement catalog ─────────────────────────────────────────
-- Keep in sync with src/lib/gamification/achievements.ts (key is the contract).
insert into public.achievements (key, name, description, emoji, xp_value) values
  ('first_steps',      'First Steps',       'Complete your profile',                         '👣', 20),
  ('event_explorer',   'Event Explorer',    'Join your first event',                         '🗺️', 25),
  ('checked_in',       'In The Room',       'Check in to an event',                          '📍', 15),
  ('first_connection', 'Icebreaker',        'Make your first connection',                    '🤝', 30),
  ('social_butterfly', 'Social Butterfly',  'Make 10 connections',                           '🦋', 100),
  ('curious_mind',     'Curious Mind',      'Answer all questions at an event',              '🧠', 25),
  ('cross_pollinator', 'Cross-Pollinator',  'Connect with someone outside your industry',    '🌸', 50),
  ('host',             'Convener',          'Host your first event',                         '🎪', 40),
  ('top_matches',      'Perfect Match',     'View your top 5 recommended matches',           '✨', 20)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      emoji = excluded.emoji,
      xp_value = excluded.xp_value;

-- ─── 6. Realtime publication for presence-adjacent tables ────────────────────
-- Presence itself is ephemeral, but broadcasting attendee + recommendation
-- changes lets the discover feed update live.
alter publication supabase_realtime add table public.event_attendees;
alter publication supabase_realtime add table public.recommendations;
