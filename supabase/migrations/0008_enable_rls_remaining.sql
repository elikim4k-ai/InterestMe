-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Enable RLS on remaining public tables (security fix)
--
-- These tables were created by Prisma but never had RLS enabled, so they were
-- publicly readable/writable via the anon key. Enable RLS and add owner-scoped
-- policies. (organizations + knowledge graph are not yet used by the app, but
-- must still be locked down.)
-- Run in the Supabase SQL Editor (after 0001–0007).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.knowledge_nodes       enable row level security;
alter table public.knowledge_edges       enable row level security;

-- ─── Knowledge graph: owned by the profile that owns the node ─────────────────
drop policy if exists "knowledge_nodes_owner" on public.knowledge_nodes;
create policy "knowledge_nodes_owner" on public.knowledge_nodes
  for all using (public.profile_owner(profile_id) = auth.uid())
  with check (public.profile_owner(profile_id) = auth.uid());

drop policy if exists "knowledge_edges_owner" on public.knowledge_edges;
create policy "knowledge_edges_owner" on public.knowledge_edges
  for all using (
    exists (
      select 1 from public.knowledge_nodes n
      where n.id = source_id and public.profile_owner(n.profile_id) = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_nodes n
      where n.id = source_id and public.profile_owner(n.profile_id) = auth.uid()
    )
  );

-- ─── Organization membership: you see/insert your own membership rows ─────────
drop policy if exists "org_members_select_self" on public.organization_members;
create policy "org_members_select_self" on public.organization_members
  for select using (user_id = auth.uid());

drop policy if exists "org_members_insert_self" on public.organization_members;
create policy "org_members_insert_self" on public.organization_members
  for insert with check (user_id = auth.uid());

-- ─── Organizations: members can read; authenticated users can create ──────────
drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "orgs_insert_authed" on public.organizations;
create policy "orgs_insert_authed" on public.organizations
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "orgs_update_member" on public.organizations;
create policy "orgs_update_member" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = id and m.user_id = auth.uid()
    )
  );
