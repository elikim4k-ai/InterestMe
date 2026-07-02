"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface Member {
  userId: string
  name: string
}

interface Session {
  groupId: string
  startedAt: number
  durationMs: number
  members: Member[]
}

interface MeetCtx {
  enabled: boolean
  session: Session | null
  secondsLeft: number
  expired: boolean
  /** Confirm you've met someone in person → start/join a shared timer. */
  confirmMet: (target: Member) => void
  /** Temporary test: solo 20-second timer to preview the countdown ending. */
  startTest: () => void
  leave: () => void
}

const Ctx = createContext<MeetCtx | null>(null)

export function useMeetSession(): MeetCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error("useMeetSession must be used within MeetSessionProvider")
  return c
}

interface PresencePayload {
  userId: string
  name: string
  groupId: string | null
  startedAt: number | null
  durationMs: number | null
}

/**
 * Live conversation-timer groups. When you confirm meeting someone, a shared
 * countdown starts for the pair; a third person who confirms with anyone in the
 * group joins the SAME timer. Group membership + merge is coordinated over a
 * Realtime channel — the person tapping "We connected" resolves the resulting
 * group and broadcasts it, and everyone included adopts it.
 */
export function MeetSessionProvider({
  eventId,
  meUserId,
  meName,
  enabled,
  durationMinutes,
  children,
}: {
  eventId: string
  meUserId: string
  meName: string
  enabled: boolean
  durationMinutes: number
  children: React.ReactNode
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [now, setNow] = useState(Date.now())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const presenceRef = useRef<Record<string, PresencePayload[]>>({})
  const trackRef = useRef<(s: Session | null) => void>(() => {})

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()
    const channel = supabase.channel(`event-meet:${eventId}`, {
      config: { presence: { key: meUserId } },
    })
    channelRef.current = channel

    const track = (s: Session | null) => {
      channel.track({
        userId: meUserId,
        name: meName,
        groupId: s?.groupId ?? null,
        startedAt: s?.startedAt ?? null,
        durationMs: s?.durationMs ?? null,
      })
    }
    trackRef.current = track

    channel
      .on("presence", { event: "sync" }, () => {
        presenceRef.current = channel.presenceState<PresencePayload>()
      })
      .on("broadcast", { event: "form" }, ({ payload }) => {
        const p = payload as Session
        if (p.members.some((m) => m.userId === meUserId)) {
          setSession(p)
          track(p)
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") track(sessionRef.current)
      })

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [enabled, eventId, meUserId, meName])

  // 1s tick for the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secondsLeft = session
    ? Math.max(0, Math.ceil((session.startedAt + session.durationMs - now) / 1000))
    : 0
  const expired = !!session && secondsLeft <= 0

  function membersWithGroup(groupId: string): Member[] {
    const out: Member[] = []
    for (const entries of Object.values(presenceRef.current)) {
      const e = entries[0]
      if (e?.groupId === groupId) out.push({ userId: e.userId, name: e.name })
    }
    return out
  }

  function confirmMet(target: Member) {
    if (!enabled) return
    // Read the target's current group (if any) from presence.
    let targetGroupId: string | null = null
    let targetStartedAt: number | null = null
    let targetDurationMs: number | null = null
    for (const entries of Object.values(presenceRef.current)) {
      const e = entries[0]
      if (e?.userId === target.userId) {
        targetGroupId = e.groupId
        targetStartedAt = e.startedAt
        targetDurationMs = e.durationMs
      }
    }

    const mine = sessionRef.current
    let groupId: string
    let startedAt: number
    let durationMs: number
    let base: Member[]

    if (targetGroupId && targetStartedAt) {
      // Join the target's existing group (they might already be a trio).
      groupId = targetGroupId
      startedAt = targetStartedAt
      durationMs = targetDurationMs ?? durationMinutes * 60_000
      base = membersWithGroup(targetGroupId)
    } else if (mine) {
      // Target joins my existing group.
      groupId = mine.groupId
      startedAt = mine.startedAt
      durationMs = mine.durationMs
      base = mine.members
    } else {
      // Fresh pair.
      groupId = crypto.randomUUID()
      startedAt = Date.now()
      durationMs = durationMinutes * 60_000
      base = []
    }

    const seen = new Set<string>()
    const members: Member[] = []
    for (const m of [...base, { userId: meUserId, name: meName }, target]) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId)
        members.push(m)
      }
    }

    const next: Session = { groupId, startedAt, durationMs, members }
    channelRef.current?.send({ type: "broadcast", event: "form", payload: next })
    setSession(next)
    trackRef.current(next)
  }

  function startTest() {
    const next: Session = {
      groupId: crypto.randomUUID(),
      startedAt: Date.now(),
      durationMs: 20_000,
      members: [{ userId: meUserId, name: meName }],
    }
    setSession(next)
    trackRef.current(next)
  }

  function leave() {
    setSession(null)
    trackRef.current(null)
  }

  return (
    <Ctx.Provider value={{ enabled, session, secondsLeft, expired, confirmMet, startTest, leave }}>
      {children}
    </Ctx.Provider>
  )
}
