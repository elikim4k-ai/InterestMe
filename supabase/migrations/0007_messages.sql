-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Direct messages (1:1 chat rooms)
-- Run in the Supabase SQL Editor (after 0001–0006).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.messages (
  id           uuid primary key default extensions.uuid_generate_v4(),
  sender_id    uuid not null references public.users(id) on delete cascade,
  receiver_id  uuid not null references public.users(id) on delete cascade,
  content      text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists messages_pair_idx
  on public.messages (sender_id, receiver_id, created_at);
create index if not exists messages_receiver_idx
  on public.messages (receiver_id, created_at);

alter table public.messages enable row level security;

-- Either party in the conversation may read the message.
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

-- You may only send as yourself.
drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender" on public.messages
  for insert with check (sender_id = auth.uid());

-- The recipient may mark messages read.
drop policy if exists "messages_update_receiver" on public.messages;
create policy "messages_update_receiver" on public.messages
  for update using (receiver_id = auth.uid());

-- Live updates for open chat rooms.
alter publication supabase_realtime add table public.messages;
