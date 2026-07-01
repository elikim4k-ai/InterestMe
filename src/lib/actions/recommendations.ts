"use server"

import { revalidatePath } from "next/cache"
import { getMatchEngine, type MatchResult } from "@/lib/ai/matching"
import { embedAndStoreProfile, type ProfileForEmbedding } from "@/lib/ai/embeddings"
import { getAuthedContext, getAuthedUser, ok, fail, type ActionResult } from "./helpers"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface RecommendationView {
  recommendedUserId: string
  displayName: string
  headline: string | null
  avatarUrl: string | null
  score: number
  reasons: string[]
  sharedInterests: string[]
  dismissed: boolean
}

/**
 * (Re)computes and persists this user's recommendations for an event.
 * Idempotent — upserts on (event, user, recommended_user).
 */
export async function generateEventRecommendations(
  eventId: string
): Promise<ActionResult<RecommendationView[]>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)

  const result = await computeAndPersistRecommendations(ctx.supabase, ctx.userId, eventId)
  // revalidatePath is only valid inside an action (never during render), so it
  // lives here rather than in the shared compute helper.
  if (result.success) revalidatePath("/discover")
  return result
}

/**
 * Pure compute + persist, WITHOUT cache invalidation. Safe to call during a
 * Server Component render (e.g. getMyRecommendations on first Discover load).
 */
async function computeAndPersistRecommendations(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
): Promise<ActionResult<RecommendationView[]>> {
  const engine = getMatchEngine()
  const matches = await engine.computeEventMatches(supabase, userId, eventId, 10)

  if (matches.length > 0) {
    const rows = matches.map((m) => ({
      event_id: eventId,
      user_id: userId,
      recommended_user_id: m.userId,
      score: m.score,
      reasons: m.reasons,
      shared_interests: m.signals.sharedInterests,
      conversation_starters: null,
    }))
    const { error } = await supabase
      .from("recommendations")
      .upsert(rows, { onConflict: "event_id,user_id,recommended_user_id" })
    if (error) return fail(error.message)
  }

  return ok(toViews(matches))
}

/** Reads persisted recommendations for the user's most recent active event. */
export async function getMyRecommendations(
  eventId?: string
): Promise<ActionResult<RecommendationView[]>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  // Resolve target event: explicit, else most recent the user is checked into
  let targetEvent = eventId
  if (!targetEvent) {
    const { data: recentAttendance } = await supabase
      .from("event_attendees")
      .select("event_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    targetEvent = recentAttendance?.event_id
  }

  if (!targetEvent) return ok([])

  const { data: recs } = await supabase
    .from("recommendations")
    .select("recommended_user_id, score, reasons, shared_interests, dismissed")
    .eq("event_id", targetEvent)
    .eq("user_id", userId)
    .eq("dismissed", false)
    .order("score", { ascending: false })

  if (!recs || recs.length === 0) {
    // None persisted yet → compute on demand. Use the render-safe helper (no
    // revalidatePath) since getMyRecommendations runs during page render.
    return computeAndPersistRecommendations(supabase, userId, targetEvent)
  }

  // Hydrate profile display data
  const ids = recs.map((r: { recommended_user_id: string }) => r.recommended_user_id)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, headline, avatar_url")
    .in("user_id", ids)

  const pMap = new Map(
    (profiles ?? []).map((p: { user_id: string }) => [p.user_id, p])
  )

  const views: RecommendationView[] = recs.map(
    (r: {
      recommended_user_id: string
      score: number
      reasons: string[]
      shared_interests: string[]
      dismissed: boolean
    }) => {
      const p = pMap.get(r.recommended_user_id) as
        | { display_name: string; headline: string | null; avatar_url: string | null }
        | undefined
      return {
        recommendedUserId: r.recommended_user_id,
        displayName: p?.display_name ?? "Attendee",
        headline: p?.headline ?? null,
        avatarUrl: p?.avatar_url ?? null,
        score: r.score,
        reasons: r.reasons ?? [],
        sharedInterests: r.shared_interests ?? [],
        dismissed: r.dismissed,
      }
    }
  )

  return ok(views)
}

export async function dismissRecommendation(
  eventId: string,
  recommendedUserId: string
): Promise<ActionResult> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)

  const { error } = await ctx.supabase
    .from("recommendations")
    .update({ dismissed: true })
    .eq("event_id", eventId)
    .eq("user_id", ctx.userId)
    .eq("recommended_user_id", recommendedUserId)

  if (error) return fail(error.message)
  revalidatePath("/discover")
  return ok(undefined)
}

/**
 * Refresh the current user's embedding from their latest profile data.
 * Call after profile/interest/goal edits and after answering event questions.
 */
export async function refreshMyEmbedding(): Promise<ActionResult> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, profileId, userId } = ctx

  const data = await loadProfileForEmbedding(supabase, userId, profileId)
  await embedAndStoreProfile(supabase, profileId, data)
  return ok(undefined)
}

async function loadProfileForEmbedding(
  supabase: SupabaseClient,
  userId: string,
  profileId: string
): Promise<ProfileForEmbedding> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, headline, bio, profile_interests(interests(name)), goals(text), projects(title)"
    )
    .eq("id", profileId)
    .single()

  const { data: answers } = await supabase
    .from("event_answers")
    .select("answer, attendee:event_attendees!inner(user_id)")
    .eq("attendee.user_id", userId)

  const interests = ((profile?.profile_interests ?? []) as Array<{ interests: { name: string } | { name: string }[] | null }>)
    .map((pi) => (Array.isArray(pi.interests) ? pi.interests[0]?.name : pi.interests?.name))
    .filter((n): n is string => Boolean(n))

  return {
    displayName: profile?.display_name ?? "",
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    interests,
    goals: ((profile?.goals ?? []) as Array<{ text: string }>).map((g) => g.text),
    projects: ((profile?.projects ?? []) as Array<{ title: string }>).map((p) => p.title),
    eventAnswers: ((answers ?? []) as Array<{ answer: string }>).map((a) => a.answer),
  }
}

function toViews(matches: MatchResult[]): RecommendationView[] {
  return matches.map((m) => ({
    recommendedUserId: m.userId,
    displayName: m.displayName,
    headline: m.headline,
    avatarUrl: m.avatarUrl,
    score: m.score,
    reasons: m.reasons,
    sharedInterests: m.signals.sharedInterests,
    dismissed: false,
  }))
}
