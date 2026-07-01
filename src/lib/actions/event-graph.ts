"use server"

import { buildEventGraph, type EventAttendee } from "@/lib/knowledge/event-graph"
import type { KnowledgeGraph } from "@/lib/knowledge/types"
import { getAuthedUser, ok, fail, type ActionResult } from "./helpers"

/**
 * Assembles the event's social graph for the current user.
 * scope "mine" = you + your matches; "room" = everyone + shared-interest edges.
 */
export async function getEventGraph(
  eventId: string,
  scope: "mine" | "room"
): Promise<ActionResult<KnowledgeGraph>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  // All attendees of the event.
  const { data: attendeeRows } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId)

  const userIds = (attendeeRows ?? []).map((a: { user_id: string }) => a.user_id)
  if (userIds.length === 0) return ok({ nodes: [], links: [] })

  // Profiles + interests for everyone.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, profile_interests(interests(name))")
    .in("user_id", userIds)

  const byUser = new Map<string, { name: string; interests: string[] }>()
  for (const p of (profiles ?? []) as Array<{
    user_id: string
    display_name: string
    profile_interests: Array<{ interests: { name: string } | { name: string }[] | null }>
  }>) {
    const interests = (p.profile_interests ?? [])
      .map((pi) => (Array.isArray(pi.interests) ? pi.interests[0]?.name : pi.interests?.name))
      .filter((n): n is string => Boolean(n))
    byUser.set(p.user_id, { name: p.display_name ?? "Attendee", interests })
  }

  const me = byUser.get(userId)

  // My persisted (non-dismissed) recommendations → the match set.
  const { data: recs } = await supabase
    .from("recommendations")
    .select("recommended_user_id, shared_interests, dismissed")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("dismissed", false)

  const matches = new Map<string, string[]>()
  for (const r of (recs ?? []) as Array<{
    recommended_user_id: string
    shared_interests: string[] | null
  }>) {
    matches.set(r.recommended_user_id, r.shared_interests ?? [])
  }

  const attendees: EventAttendee[] = userIds
    .filter((id: string) => id !== userId)
    .map((id: string) => {
      const info = byUser.get(id)
      return { userId: id, name: info?.name ?? "Attendee", interests: info?.interests ?? [] }
    })

  const graph = buildEventGraph({
    meUserId: userId,
    meName: me?.name ?? "You",
    meInterests: me?.interests ?? [],
    attendees,
    matches,
    scope,
  })

  return ok(graph)
}
