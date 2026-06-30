"use server"

import { createClient } from "@/lib/supabase/server"
import {
  ACHIEVEMENT_MAP,
  evaluateAchievements,
  type UserStats,
} from "@/lib/gamification/achievements"
import { getAuthedUser, ok, fail, type ActionResult } from "./helpers"

export interface UnlockedAchievement {
  key: string
  name: string
  description: string
  emoji: string
  xpValue: number
}

/**
 * Evaluates the user's stats, unlocks any newly-earned achievements (idempotent),
 * and returns the ones that were *newly* unlocked this call so the UI can
 * celebrate them.
 */
export async function syncAchievements(
  overrides: Partial<UserStats> = {}
): Promise<ActionResult<UnlockedAchievement[]>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const stats = await gatherStats(supabase, userId, overrides)
  const earnedKeys = evaluateAchievements(stats)
  if (earnedKeys.length === 0) return ok([])

  // Which achievement rows exist for these keys?
  const { data: achievementRows } = await supabase
    .from("achievements")
    .select("id, key")
    .in("key", earnedKeys)

  const keyToId = new Map(
    (achievementRows ?? []).map((a: { id: string; key: string }) => [a.key, a.id])
  )

  // Already unlocked?
  const { data: existing } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId)

  const unlockedIds = new Set(
    (existing ?? []).map((u: { achievement_id: string }) => u.achievement_id)
  )

  const toInsert = earnedKeys
    .map((key) => keyToId.get(key))
    .filter((id): id is string => Boolean(id) && !unlockedIds.has(id!))
    .map((achievement_id) => ({ user_id: userId, achievement_id }))

  if (toInsert.length === 0) return ok([])

  const { error } = await supabase
    .from("user_achievements")
    .upsert(toInsert, { onConflict: "user_id,achievement_id", ignoreDuplicates: true })
  if (error) return fail(error.message)

  const newlyUnlocked: UnlockedAchievement[] = toInsert
    .map((row) => {
      const key = [...keyToId.entries()].find(([, id]) => id === row.achievement_id)?.[0]
      const def = key ? ACHIEVEMENT_MAP[key] : undefined
      return def
        ? {
            key: def.key,
            name: def.name,
            description: def.description,
            emoji: def.emoji,
            xpValue: def.xpValue,
          }
        : null
    })
    .filter((x): x is UnlockedAchievement => x !== null)

  return ok(newlyUnlocked)
}

export interface BadgeView {
  key: string
  name: string
  description: string
  emoji: string
  xpValue: number
  unlocked: boolean
  unlockedAt: string | null
}

/** Returns the full catalog with the user's unlock state + total XP. */
export async function getMyBadges(): Promise<
  ActionResult<{ badges: BadgeView[]; totalXp: number; unlockedCount: number }>
> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const { data: unlocked } = await supabase
    .from("user_achievements")
    .select("unlocked_at, achievement:achievements(key)")
    .eq("user_id", userId)

  const unlockedMap = new Map<string, string>()
  for (const row of (unlocked ?? []) as Array<{
    unlocked_at: string
    achievement: { key: string } | { key: string }[] | null
  }>) {
    const ach = Array.isArray(row.achievement) ? row.achievement[0] : row.achievement
    if (ach) unlockedMap.set(ach.key, row.unlocked_at)
  }

  let totalXp = 0
  const badges: BadgeView[] = Object.values(ACHIEVEMENT_MAP)
    .filter((def) => !def.hidden || unlockedMap.has(def.key))
    .map((def) => {
      const isUnlocked = unlockedMap.has(def.key)
      if (isUnlocked) totalXp += def.xpValue
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        emoji: def.emoji,
        xpValue: def.xpValue,
        unlocked: isUnlocked,
        unlockedAt: unlockedMap.get(def.key) ?? null,
      }
    })

  return ok({ badges, totalXp, unlockedCount: unlockedMap.size })
}

async function gatherStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  overrides: Partial<UserStats>
): Promise<UserStats> {
  const [{ data: profile }, attendances, { count: hostedEvents }, { count: connections }] =
    await Promise.all([
      supabase.from("profiles").select("onboarding_done").eq("user_id", userId).single(),
      supabase
        .from("event_attendees")
        .select("status")
        .eq("user_id", userId),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("organizer_id", userId),
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "ACCEPTED"),
    ])

  const attendanceRows = (attendances.data ?? []) as Array<{ status: string }>

  return {
    profileComplete: profile?.onboarding_done ?? false,
    eventsJoined: attendanceRows.length,
    eventsCheckedIn: attendanceRows.filter((a) => a.status === "CHECKED_IN").length,
    connections: connections ?? 0,
    hostedEvents: hostedEvents ?? 0,
    answeredAllAtAnyEvent: false,
    connectedOutsideIndustry: false,
    viewedTopMatches: false,
    ...overrides,
  }
}
