-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Fix updated_at handling for Supabase-client writes
--
-- Prisma's @updatedAt is applied by the Prisma *client*. We write through the
-- Supabase client instead, so updated_at was never populated → NOT NULL inserts
-- failed. This migration makes updated_at self-managing at the DB level:
--   1. DEFAULT now()  → inserts succeed without specifying it
--   2. BEFORE UPDATE trigger → keeps it accurate on every modification
-- Run in the Supabase SQL Editor after 0001 and 0002.
-- ════════════════════════════════════════════════════════════════════════════

-- Shared trigger function: stamp updated_at on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply DEFAULT + trigger to every table that has an updated_at column.
do $$
declare
  t text;
  tables text[] := array[
    'users',
    'profiles',
    'organizations',
    'projects',
    'events',
    'event_answers',
    'connections',
    'privacy_settings'
  ];
begin
  foreach t in array tables loop
    -- Backfill any existing NULLs so the column can hold a sane value
    execute format(
      'update public.%I set updated_at = now() where updated_at is null',
      t
    );

    -- Ensure inserts work without specifying updated_at
    execute format(
      'alter table public.%I alter column updated_at set default now()',
      t
    );

    -- (Re)create the auto-update trigger
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;
