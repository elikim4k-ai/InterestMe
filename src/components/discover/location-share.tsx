"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { FindOverlay } from "./find-overlay"
import { FlashBeacon } from "./flash-beacon"
import { useMeetSession } from "./meet-session"

export interface Coords {
  lat: number
  lng: number
}

export interface PositionInfo extends Coords {
  name: string
  accuracy: number
}

interface LocationShareCtx {
  enabled: boolean
  error: string | null
  myCoords: Coords | null
  myAccuracy: number | null
  positions: Map<string, PositionInfo>
  enable: () => void
  find: (target: { userId: string; name: string }) => void
  /** Flash my screen + alert the target so we can spot each other. */
  signal: (target: { userId: string; name: string }) => void
}

const Ctx = createContext<LocationShareCtx | null>(null)

export function useLocationShare(): LocationShareCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error("useLocationShare must be used within LocationShareProvider")
  return c
}

/**
 * Shares the current user's location to a per-event Realtime channel while on
 * Discover, so others can "Find" them without both parties opening a finder.
 * Requests location as soon as Discover mounts (per product request). Location
 * is only broadcast while this provider is mounted (i.e. while on Discover).
 */
export function LocationShareProvider({
  eventId,
  meUserId,
  meName,
  children,
}: {
  eventId: string
  meUserId: string
  meName: string
  children: React.ReactNode
}) {
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myCoords, setMyCoords] = useState<Coords | null>(null)
  const [myAccuracy, setMyAccuracy] = useState<number | null>(null)
  const [positions, setPositions] = useState<Map<string, PositionInfo>>(new Map())
  const [finding, setFinding] = useState<{ userId: string; name: string } | null>(null)
  const [flash, setFlash] = useState<{
    name: string
    subtitle: string
    connectWith?: { userId: string; name: string }
  } | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const latestRef = useRef<(Coords & { accuracy: number }) | null>(null)
  const meet = useMeetSession()

  // Broadcast my latest coords — only meaningful once the channel is subscribed.
  function broadcast() {
    const c = latestRef.current
    if (c && subscribedRef.current) {
      channelRef.current?.track({
        userId: meUserId,
        name: meName,
        lat: c.lat,
        lng: c.lng,
        accuracy: c.accuracy,
      })
    }
  }

  // Subscribe to the shared channel once and track everyone's positions.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`event-locate:${eventId}`, {
      config: { presence: { key: meUserId } },
    })
    channelRef.current = channel
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string
          name: string
          lat: number
          lng: number
          accuracy?: number
        }>()
        const map = new Map<string, PositionInfo>()
        for (const entries of Object.values(state)) {
          const e = entries[0]
          if (e && typeof e.lat === "number" && typeof e.lng === "number") {
            map.set(e.userId, {
              name: e.name,
              lat: e.lat,
              lng: e.lng,
              accuracy: e.accuracy ?? 999,
            })
          }
        }
        setPositions(map)
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const p = payload as { toUserId: string; fromUserId: string; fromName: string }
        if (p.toUserId === meUserId) {
          // Show MY name big (so others spot my phone) + who I'm pairing with.
          setFlash({
            name: meName,
            subtitle: `looking for ${p.fromName}`,
            connectWith: { userId: p.fromUserId, name: p.fromName },
          })
        }
      })
      .on("broadcast", { event: "flash-close" }, ({ payload }) => {
        const p = payload as { toUserId: string }
        if (p.toUserId === meUserId) setFlash(null)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true
          broadcast() // push whatever coords we already have
        }
      })
    // On returning to the foreground (phone woke), re-broadcast so we reappear.
    const onVisible = () => {
      if (document.visibilityState === "visible") broadcast()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      subscribedRef.current = false
      channelRef.current = null
      document.removeEventListener("visibilitychange", onVisible)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, meUserId, meName])

  // Watch my location while enabled and broadcast it.
  useEffect(() => {
    if (!enabled) return
    if (!("geolocation" in navigator)) {
      setError("Your device doesn't support location.")
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        latestRef.current = { ...c, accuracy: pos.coords.accuracy }
        setMyCoords(c)
        setMyAccuracy(pos.coords.accuracy)
        broadcast()
      },
      (err) => setError(err.code === err.PERMISSION_DENIED ? "denied" : err.message),
      // maximumAge: 0 forces a fresh fix each update (avoids stale cached coords).
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meUserId, meName])

  // Request location as soon as Discover loads.
  useEffect(() => {
    setEnabled(true)
  }, [])

  function signal(target: { userId: string; name: string }) {
    // My screen shows MY name (for others to spot) + who I'm looking for.
    setFlash({ name: meName, subtitle: `looking for ${target.name}`, connectWith: target })
    // …and ping the target so they know to look around.
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { toUserId: target.userId, fromUserId: meUserId, fromName: meName },
    })
  }

  // Connect from the flash: start the shared timer AND close both flashes.
  function flashConnect(other: { userId: string; name: string }) {
    meet.confirmMet(other)
    channelRef.current?.send({
      type: "broadcast",
      event: "flash-close",
      payload: { toUserId: other.userId },
    })
    setFlash(null)
  }

  // Manual dismiss: close both flashes.
  function flashDismiss(otherUserId?: string) {
    if (otherUserId) {
      channelRef.current?.send({
        type: "broadcast",
        event: "flash-close",
        payload: { toUserId: otherUserId },
      })
    }
    setFlash(null)
  }

  return (
    <Ctx.Provider
      value={{
        enabled,
        error,
        myCoords,
        myAccuracy,
        positions,
        enable: () => setEnabled(true),
        find: setFinding,
        signal,
      }}
    >
      {children}
      {finding && <FindOverlay target={finding} onClose={() => setFinding(null)} />}
      {flash && (
        <FlashBeacon
          name={flash.name}
          subtitle={flash.subtitle}
          canConnect={!!flash.connectWith && meet.enabled}
          onConnect={() => flash.connectWith && flashConnect(flash.connectWith)}
          onDismiss={() => flashDismiss(flash.connectWith?.userId)}
          onExpire={() => setFlash(null)}
        />
      )}
    </Ctx.Provider>
  )
}
