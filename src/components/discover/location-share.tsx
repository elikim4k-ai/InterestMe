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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const latestRef = useRef<(Coords & { accuracy: number }) | null>(null)

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true
          broadcast() // push whatever coords we already have
        }
      })
    return () => {
      subscribedRef.current = false
      channelRef.current = null
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
      }}
    >
      {children}
      {finding && <FindOverlay target={finding} onClose={() => setFinding(null)} />}
    </Ctx.Provider>
  )
}
