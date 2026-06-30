"use server"

import { getAuthedContext, ok, fail, type ActionResult } from "./helpers"

export interface PersonalAnalytics {
  eventsAttended: number
  connectionsMade: number
  interestsCount: number
  projectsCount: number
  goalsCount: number
  achievementsUnlocked: number
  totalXp: number
  /** Connections grouped by the event where they were made. */
  connectionsByEvent: { eventName: string; count: number }[]
  /** Most common interests among the people you've connected with. */
  networkInterests: { name: string; count: number }[]
  /** Activity over the last 8 weeks (connections per week). */
  weeklyActivity: { week: string; count: number }[]
}

/** Personal networking analytics for the current user. */
export async function getPersonalAnalytics(): Promise<ActionResult<PersonalAnalytics>> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, profileId, userId } = ctx

  const [
    { count: eventsAttended },
    { data: profileCounts },
    { data: connections },
    { count: achievementsUnlocked },
  ] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("profile_interests(count), projects(count), goals(count)")
      .eq("id", profileId)
      .single(),
    supabase
      .from("connections")
      .select("sender_id, receiver_id, created_at, met_at_event_id, met_at_event:events!connections_met_at_event_id_fkey(name)")
      .eq("status", "ACCEPTED")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    supabase
      .from("user_achievements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ])

  const conns = (connections ?? []) as Array<{
    sender_id: string
    receiver_id: string
    created_at: string
    met_at_event_id: string | null
    met_at_event: { name: string } | { name: string }[] | null
  }>

  // Connections by event
  const eventBuckets = new Map<string, number>()
  for (const c of conns) {
    const ev = Array.isArray(c.met_at_event) ? c.met_at_event[0] : c.met_at_event
    const name = ev?.name ?? "Other"
    eventBuckets.set(name, (eventBuckets.get(name) ?? 0) + 1)
  }
  const connectionsByEvent = [...eventBuckets.entries()]
    .map(([eventName, count]) => ({ eventName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Network interests — interests of people I'm connected to
  const otherIds = conns
    .map((c) => (c.sender_id === userId ? c.receiver_id : c.sender_id))
    .filter(Boolean)

  let networkInterests: { name: string; count: number }[] = []
  if (otherIds.length > 0) {
    const { data: theirProfiles } = await supabase
      .from("profiles")
      .select("profile_interests(interests(name))")
      .in("user_id", otherIds)

    const interestBuckets = new Map<string, number>()
    for (const p of (theirProfiles ?? []) as Array<{
      profile_interests: Array<{ interests: { name: string } | { name: string }[] | null }>
    }>) {
      for (const pi of p.profile_interests ?? []) {
        const interest = Array.isArray(pi.interests) ? pi.interests[0] : pi.interests
        if (interest?.name) {
          interestBuckets.set(interest.name, (interestBuckets.get(interest.name) ?? 0) + 1)
        }
      }
    }
    networkInterests = [...interestBuckets.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }

  // Weekly activity (last 8 weeks)
  const weeklyActivity = buildWeeklyActivity(conns.map((c) => c.created_at))

  // XP from unlocked achievements
  const { data: xpRows } = await supabase
    .from("user_achievements")
    .select("achievement:achievements(xp_value)")
    .eq("user_id", userId)
  const totalXp = ((xpRows ?? []) as Array<{
    achievement: { xp_value: number } | { xp_value: number }[] | null
  }>).reduce((sum, r) => {
    const a = Array.isArray(r.achievement) ? r.achievement[0] : r.achievement
    return sum + (a?.xp_value ?? 0)
  }, 0)

  const counts = profileCounts as
    | {
        profile_interests: { count: number }[]
        projects: { count: number }[]
        goals: { count: number }[]
      }
    | null

  return ok({
    eventsAttended: eventsAttended ?? 0,
    connectionsMade: conns.length,
    interestsCount: counts?.profile_interests?.[0]?.count ?? 0,
    projectsCount: counts?.projects?.[0]?.count ?? 0,
    goalsCount: counts?.goals?.[0]?.count ?? 0,
    achievementsUnlocked: achievementsUnlocked ?? 0,
    totalXp,
    connectionsByEvent,
    networkInterests,
    weeklyActivity,
  })
}

function buildWeeklyActivity(dates: string[]): { week: string; count: number }[] {
  const weeks: { week: string; count: number }[] = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const count = dates.filter((d) => {
      const dt = new Date(d)
      return dt >= start && dt < end
    }).length
    weeks.push({
      week: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    })
  }
  return weeks
}

export interface EventAnalytics {
  eventName: string
  totalRegistered: number
  totalCheckedIn: number
  checkInRate: number
  answersSubmitted: number
  connectionsMade: number
  topInterests: { name: string; count: number }[]
}

/** Organizer analytics for a specific event they own. */
export async function getEventAnalytics(
  eventId: string
): Promise<ActionResult<EventAnalytics>> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const { data: event } = await supabase
    .from("events")
    .select("name, organizer_id")
    .eq("id", eventId)
    .single()

  if (!event) return fail("Event not found")
  if (event.organizer_id !== userId) return fail("Not authorized")

  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("id, status, user_id")
    .eq("event_id", eventId)

  const rows = (attendees ?? []) as Array<{ id: string; status: string; user_id: string }>
  const totalRegistered = rows.length
  const totalCheckedIn = rows.filter((a) => a.status === "CHECKED_IN").length

  const attendeeIds = rows.map((a) => a.id)
  const { count: answersSubmitted } = attendeeIds.length
    ? await supabase
        .from("event_answers")
        .select("id", { count: "exact", head: true })
        .in("attendee_id", attendeeIds)
    : { count: 0 }

  const { count: connectionsMade } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("met_at_event_id", eventId)

  // Top interests among attendees
  const userIds = rows.map((a) => a.user_id)
  let topInterests: { name: string; count: number }[] = []
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("profile_interests(interests(name))")
      .in("user_id", userIds)

    const buckets = new Map<string, number>()
    for (const p of (profiles ?? []) as Array<{
      profile_interests: Array<{ interests: { name: string } | { name: string }[] | null }>
    }>) {
      for (const pi of p.profile_interests ?? []) {
        const interest = Array.isArray(pi.interests) ? pi.interests[0] : pi.interests
        if (interest?.name) buckets.set(interest.name, (buckets.get(interest.name) ?? 0) + 1)
      }
    }
    topInterests = [...buckets.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }

  return ok({
    eventName: event.name,
    totalRegistered,
    totalCheckedIn,
    checkInRate: totalRegistered ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
    answersSubmitted: answersSubmitted ?? 0,
    connectionsMade: connectionsMade ?? 0,
    topInterests,
  })
}
