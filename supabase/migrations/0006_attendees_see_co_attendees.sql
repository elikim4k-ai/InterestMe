-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Let attendees see their co-attendees (fixes matching)
--
-- The original event_attendees SELECT policy only exposed your OWN attendee row
-- (or all rows if you're the organizer). So the match engine, running as a
-- regular attendee, could only "see" itself among the attendees → nobody to
-- match against → Discover was always empty.
--
-- Networking is the whole point: anyone attending an event may see the other
-- people attending that same event. is_event_attendee() is SECURITY DEFINER, so
-- this does not recurse into the policy.
-- Run in the Supabase SQL Editor (after 0001–0005).
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "event_attendees_select_co_attendees" on public.event_attendees;
create policy "event_attendees_select_co_attendees" on public.event_attendees
  for select using (public.is_event_attendee(event_id));
