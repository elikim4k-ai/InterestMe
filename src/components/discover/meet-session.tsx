"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { MeetTimerOverlay } from "./meet-timer-overlay"

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
  minimized: boolean
  confirmMet: (target: Member) => void
  startTest: () => void
  leave: () => void
  minimize: () => void
  expand: () => void
  /** True if this user is currently in an active (unexpired) conversation. */
  isBusy: (userId: string) => boolean
  /** Wait for a busy person; get a toast reminder when their timer ends. */
  waitlistFor: (target: Member) => void
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
  const [minimized, setMinimized] = useState(false)
  const [waitlist, setWaitlist] = useState<Member[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const presenceRef = useRef<Record<string, PresencePayload[]>>({})
  const trackRef = useRef<(s: Session | null) => void>(() => {})

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  function isBusy(userId: string): boolean {
    for (const entries of Object.values(presenceRef.current)) {
      const e = entries[0]
      if (e?.userId === userId && e.groupId && e.startedAt && e.durationMs) {
        if (Date.now() < e.startedAt + e.durationMs) return true
      }
    }
    return false
  }

  function membersWithGroup(groupId: string): Member[] {
    const out: Member[] = []
    for (const entries of Object.values(presenceRef.current)) {
      const e = entries[0]
      if (e?.groupId === groupId) out.push({ userId: e.userId, name: e.name })
    }
    return out
  }

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
          setMinimized(false)
          track(p)
        }
      })
      .on("broadcast", { event: "waitlist" }, ({ payload }) => {
        const p = payload as { toUserId: string; fromName: string }
        if (p.toUserId === meUserId) toast(`${p.fromName} is waiting to meet you next 👋`)
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

  // Waitlist reminders: nudge when a busy person's timer ends.
  useEffect(() => {
    if (waitlist.length === 0) return
    const t = setInterval(() => {
      const freed = waitlist.filter((m) => !isBusy(m.userId))
      if (freed.length > 0) {
        freed.forEach((m) => toast(`${m.name} is free now — go say hi! 👋`))
        setWaitlist((w) => w.filter((m) => isBusy(m.userId)))
      }
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitlist])

  const secondsLeft = session
    ? Math.max(0, Math.ceil((session.startedAt + session.durationMs - now) / 1000))
    : 0
  const expired = !!session && secondsLeft <= 0

  function confirmMet(target: Member) {
    if (!enabled) return

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
      groupId = targetGroupId
      startedAt = targetStartedAt
      durationMs = targetDurationMs ?? durationMinutes * 60_000
      base = membersWithGroup(targetGroupId)
    } else if (mine) {
      groupId = mine.groupId
      startedAt = mine.startedAt
      durationMs = mine.durationMs
      base = mine.members
    } else {
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
    setMinimized(false)
    trackRef.current(next)
  }

  function waitlistFor(target: Member) {
    setWaitlist((w) => (w.some((m) => m.userId === target.userId) ? w : [...w, target]))
    toast(`${target.name} is in a conversation. You're on the waitlist — we'll nudge you when they're free.`)
    channelRef.current?.send({
      type: "broadcast",
      event: "waitlist",
      payload: { toUserId: target.userId, fromName: meName },
    })
  }

  function startTest() {
    const next: Session = {
      groupId: crypto.randomUUID(),
      startedAt: Date.now(),
      durationMs: 20_000,
      members: [{ userId: meUserId, name: meName }],
    }
    setSession(next)
    setMinimized(false)
    trackRef.current(next)
  }

  function leave() {
    setSession(null)
    trackRef.current(null)
  }

  return (
    <Ctx.Provider
      value={{
        enabled,
        session,
        secondsLeft,
        expired,
        minimized,
        confirmMet,
        startTest,
        leave,
        minimize: () => setMinimized(true),
        expand: () => setMinimized(false),
        isBusy,
        waitlistFor,
      }}
    >
      {children}
      {session && !minimized && <MeetTimerOverlay />}
    </Ctx.Provider>
  )
}
