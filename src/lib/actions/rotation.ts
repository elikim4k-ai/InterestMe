"use server"

import { getAuthedUser, ok, fail, type ActionResult } from "./helpers"

export interface RotationState {
  enabled: boolean
  started: boolean
  /** 1-based round number (when started). */
  round: number
  totalRounds: number
  roundMinutes: number
  secondsToNext: number
  /** The person to meet this round; null when sitting out or solo. */
  partner: { userId: string; name: string } | null
  bye: boolean
  startsInSeconds: number
}

const BYE = "__bye__"

/**
 * Round-robin (circle method) partner for a given round. Deterministic given
 * the same sorted id list, so both people in a pair compute each other.
 */
function partnerForRound(sortedIds: string[], round: number, meId: string): string | null {
  const players = [...sortedIds]
  if (players.length % 2 === 1) players.push(BYE)
  const n = players.length
  if (n < 2) return null

  const fixed = players[0]!
  const tail = players.slice(1)
  const rot = ((round % (n - 1)) + (n - 1)) % (n - 1)
  const rotatedTail = [...tail.slice(tail.length - rot), ...tail.slice(0, tail.length - rot)]
  const arr = [fixed, ...rotatedTail]

  for (let i = 0; i < n / 2; i++) {
    const a = arr[i]!
    const b = arr[n - 1 - i]!
    if (a === meId) return b
    if (b === meId) return a
  }
  return null
}

/** Current networking-round state for the signed-in user at an event. */
export async function getCurrentRotation(eventId: string): Promise<ActionResult<RotationState>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const { data: event } = await supabase
    .from("events")
    .select("rotation_enabled, rotation_minutes, start_time")
    .eq("id", eventId)
    .single()

  const base: RotationState = {
    enabled: false,
    started: false,
    round: 0,
    totalRounds: 0,
    roundMinutes: 0,
    secondsToNext: 0,
    partner: null,
    bye: false,
    startsInSeconds: 0,
  }

  if (!event?.rotation_enabled) return ok(base)

  const roundMinutes = event.rotation_minutes ?? 15
  const interval = roundMinutes * 60_000
  const start = new Date(event.start_time).getTime()
  const now = Date.now()

  // Attendees drive the schedule. Prefer checked-in; fall back to all.
  const { data: attendeeRows } = await supabase
    .from("event_attendees")
    .select("user_id, status")
    .eq("event_id", eventId)

  const rows = (attendeeRows ?? []) as Array<{ user_id: string; status: string }>
  const checkedIn = rows.filter((r) => r.status === "CHECKED_IN").map((r) => r.user_id)
  const ids = (checkedIn.length >= 2 ? checkedIn : rows.map((r) => r.user_id)).sort()

  const totalRounds = ids.length >= 2 ? (ids.length % 2 === 1 ? ids.length : ids.length - 1) : 0

  if (now < start) {
    return ok({
      ...base,
      enabled: true,
      roundMinutes,
      totalRounds,
      startsInSeconds: Math.ceil((start - now) / 1000),
    })
  }

  const round = Math.floor((now - start) / interval)
  const secondsToNext = Math.ceil((interval - ((now - start) % interval)) / 1000)
  const partnerId = partnerForRound(ids, round, userId)

  let partner: { userId: string; name: string } | null = null
  let bye = false
  if (partnerId === BYE || partnerId === null) {
    bye = ids.includes(userId) // in the pool but got the bye this round
  } else {
    const { data: p } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", partnerId)
      .single()
    partner = { userId: partnerId, name: p?.display_name ?? "Someone" }
  }

  return ok({
    enabled: true,
    started: true,
    round: round + 1,
    totalRounds,
    roundMinutes,
    secondsToNext,
    partner,
    bye,
    startsInSeconds: 0,
  })
}
