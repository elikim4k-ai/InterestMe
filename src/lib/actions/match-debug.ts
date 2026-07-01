"use server"

import { getAIProvider } from "@/lib/ai/provider"
import { getMatchEngine } from "@/lib/ai/matching"
import { getAuthedUser, ok, fail, type ActionResult } from "./helpers"

export interface MatchDebug {
  provider: string
  isLive: boolean
  attendees: number
  others: number
  matchCount: number
  topReason: string | null
  engineResult: string
}

/**
 * Runs the real match pipeline and returns what it produced — surfaced in the
 * UI so we don't depend on server logs to diagnose "no matches".
 */
export async function getMatchDebug(eventId: string): Promise<ActionResult<MatchDebug>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const provider = getAIProvider()

  const [{ count: attendees }, { count: others }] = await Promise.all([
    supabase.from("event_attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .neq("user_id", userId),
  ])

  let matchCount = 0
  let topReason: string | null = null
  let engineResult = "ok"
  try {
    const matches = await getMatchEngine().computeEventMatches(supabase, userId, eventId, 10)
    matchCount = matches.length
    topReason = matches[0]?.reasons?.[0] ?? null
  } catch (e) {
    engineResult = "ERROR: " + (e instanceof Error ? e.message : String(e))
  }

  return ok({
    provider: provider.name,
    isLive: provider.isLive,
    attendees: attendees ?? 0,
    others: others ?? 0,
    matchCount,
    topReason,
    engineResult,
  })
}
