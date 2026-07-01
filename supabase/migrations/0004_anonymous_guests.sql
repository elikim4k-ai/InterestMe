-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Anonymous guest support
--
-- Enables the frictionless "scan → try → decide" flow via Supabase Anonymous
-- Auth. Anonymous users are real auth.users rows (is_anonymous = true) so all
-- existing RLS / matching / profile logic works unchanged.
--
-- PREREQUISITE: enable Authentication → Sign In/Providers → Anonymous Sign-ins
-- in the Supabase dashboard. This migration handles the DB side.
-- Run after 0001–0003.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Fix profile bootstrap for users with no email (guests) ───────────────
-- Anonymous users have email = NULL, so the old display_name expression
-- resolved to NULL and violated the NOT NULL constraint. Fall back to "Guest".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role, created_at, updated_at)
  values (new.id, new.email, 'USER', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (user_id, display_name, onboarding_done, created_at, updated_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ),
    false,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  insert into public.privacy_settings (user_id, updated_at)
  values (new.id, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ─── 2. Cleanup for abandoned guests ─────────────────────────────────────────
-- Deletes anonymous users who never converted and have been idle. Cascade
-- deletes remove their profile, answers, etc. Converted users (is_anonymous
-- flips to false on email/OAuth link) are never touched.
create or replace function public.cleanup_abandoned_guests(idle_days int default 7)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_count int;
begin
  with removed as (
    delete from auth.users u
    where u.is_anonymous = true
      and coalesce(u.last_sign_in_at, u.created_at) < now() - (idle_days || ' days')::interval
    returning u.id
  )
  select count(*) into deleted_count from removed;
  return deleted_count;
end;
$$;

-- ─── 3. Schedule the cleanup daily (best-effort; needs pg_cron) ───────────────
-- pg_cron is available on Supabase but may need enabling under Database →
-- Extensions. If it isn't enabled this block is skipped without failing.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-abandoned-guests',
      '0 4 * * *', -- 04:00 UTC daily
      $cron$ select public.cleanup_abandoned_guests(7); $cron$
    );
  end if;
exception when others then
  -- Scheduling is optional; ignore if pg_cron isn't fully configured.
  null;
end;
$$;
