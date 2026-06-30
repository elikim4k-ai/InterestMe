-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Auth triggers, profile bootstrap, and Row-Level Security
-- Run AFTER `prisma db push` has created the tables.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Bootstrap public.users + profiles + privacy_settings on signup ───────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile_id uuid;
begin
  -- Mirror auth.users into public.users
  insert into public.users (id, email, role, created_at, updated_at)
  values (new.id, new.email, 'USER', now(), now())
  on conflict (id) do nothing;

  -- Create an empty profile (onboarding completes it)
  insert into public.profiles (user_id, display_name, onboarding_done, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    false,
    now(),
    now()
  )
  on conflict (user_id) do nothing
  returning id into new_profile_id;

  -- Default privacy settings
  insert into public.privacy_settings (user_id, updated_at)
  values (new.id, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email in sync on update
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

-- ─── 2. Enable RLS on all tenant tables ──────────────────────────────────────

alter table public.users              enable row level security;
alter table public.profiles           enable row level security;
alter table public.profile_interests  enable row level security;
alter table public.interests          enable row level security;
alter table public.projects           enable row level security;
alter table public.goals              enable row level security;
alter table public.events             enable row level security;
alter table public.event_attendees    enable row level security;
alter table public.event_questions    enable row level security;
alter table public.event_answers      enable row level security;
alter table public.connections        enable row level security;
alter table public.recommendations    enable row level security;
alter table public.notifications      enable row level security;
alter table public.privacy_settings   enable row level security;
alter table public.activity_logs      enable row level security;

-- ─── 3. Helper: is current user an attendee of an event? ─────────────────────

create or replace function public.is_event_attendee(_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.event_attendees
    where event_id = _event_id and user_id = auth.uid()
  );
$$;

create or replace function public.profile_owner(_profile_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select user_id from public.profiles where id = _profile_id;
$$;

-- ─── 4. Policies ─────────────────────────────────────────────────────────────

-- USERS: a user can read/update only their own row
create policy "users_select_self" on public.users
  for select using (auth.uid() = id);
create policy "users_update_self" on public.users
  for update using (auth.uid() = id);

-- PROFILES: readable by self + anyone for discovery (privacy enforced in app layer
-- for v1; tighten with privacy_settings join in Phase 4). Writable by owner only.
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = user_id);

-- INTERESTS taxonomy: world-readable, any authed user may insert new tags
create policy "interests_select_all" on public.interests
  for select using (true);
create policy "interests_insert_authed" on public.interests
  for insert with check (auth.role() = 'authenticated');

-- PROFILE_INTERESTS / PROJECTS / GOALS: readable by all, writable by owner
create policy "profile_interests_select_all" on public.profile_interests
  for select using (true);
create policy "profile_interests_write_owner" on public.profile_interests
  for all using (public.profile_owner(profile_id) = auth.uid())
  with check (public.profile_owner(profile_id) = auth.uid());

create policy "projects_select_all" on public.projects
  for select using (true);
create policy "projects_write_owner" on public.projects
  for all using (public.profile_owner(profile_id) = auth.uid())
  with check (public.profile_owner(profile_id) = auth.uid());

create policy "goals_select_all" on public.goals
  for select using (true);
create policy "goals_write_owner" on public.goals
  for all using (public.profile_owner(profile_id) = auth.uid())
  with check (public.profile_owner(profile_id) = auth.uid());

-- EVENTS: public events readable by all; private readable by organizer/attendees.
-- Writable by organizer only.
create policy "events_select_public_or_member" on public.events
  for select using (
    is_public = true
    or organizer_id = auth.uid()
    or public.is_event_attendee(id)
  );
create policy "events_insert_organizer" on public.events
  for insert with check (auth.uid() = organizer_id);
create policy "events_update_organizer" on public.events
  for update using (auth.uid() = organizer_id);
create policy "events_delete_organizer" on public.events
  for delete using (auth.uid() = organizer_id);

-- EVENT_QUESTIONS: readable by anyone who can see the event; writable by organizer
create policy "event_questions_select" on public.event_questions
  for select using (
    exists (select 1 from public.events e where e.id = event_id
            and (e.is_public or e.organizer_id = auth.uid() or public.is_event_attendee(e.id)))
  );
create policy "event_questions_write_organizer" on public.event_questions
  for all using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

-- EVENT_ATTENDEES: attendee manages own row; organizer can read all for their event
create policy "event_attendees_select" on public.event_attendees
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );
create policy "event_attendees_insert_self" on public.event_attendees
  for insert with check (user_id = auth.uid());
create policy "event_attendees_update_self" on public.event_attendees
  for update using (user_id = auth.uid());

-- EVENT_ANSWERS: visible to fellow attendees (shared context); writable by author
create policy "event_answers_select_attendees" on public.event_answers
  for select using (
    exists (
      select 1 from public.event_attendees a
      where a.id = attendee_id
        and (a.user_id = auth.uid() or public.is_event_attendee(a.event_id))
    )
  );
create policy "event_answers_write_owner" on public.event_answers
  for all using (
    exists (select 1 from public.event_attendees a where a.id = attendee_id and a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.event_attendees a where a.id = attendee_id and a.user_id = auth.uid())
  );

-- CONNECTIONS: visible to either party; writable by sender
create policy "connections_select_party" on public.connections
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "connections_insert_sender" on public.connections
  for insert with check (sender_id = auth.uid());
create policy "connections_update_party" on public.connections
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());

-- RECOMMENDATIONS: visible only to the target user
create policy "recommendations_select_self" on public.recommendations
  for select using (user_id = auth.uid());
create policy "recommendations_update_self" on public.recommendations
  for update using (user_id = auth.uid());

-- NOTIFICATIONS: owner only
create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid());

-- PRIVACY_SETTINGS: owner only
create policy "privacy_select_self" on public.privacy_settings
  for select using (user_id = auth.uid());
create policy "privacy_update_self" on public.privacy_settings
  for update using (user_id = auth.uid());

-- ACTIVITY_LOGS: owner read-only (writes go through service role)
create policy "activity_logs_select_self" on public.activity_logs
  for select using (user_id = auth.uid());
