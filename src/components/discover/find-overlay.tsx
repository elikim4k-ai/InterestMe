"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Navigation, X, Compass, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface Coords {
  lat: number
  lng: number
}

/**
 * "Warmer / colder" finder. Both people share live location over a Realtime
 * channel; we show approximate distance + a compass arrow pointing toward the
 * target. Indoor GPS is coarse (~5–15m), so this is a playful treasure-hunt,
 * not precise navigation. Location is shared ONLY while this overlay is open.
 */
export function FindOverlay({
  eventId,
  meUserId,
  meName,
  target,
  onClose,
}: {
  eventId: string
  meUserId: string
  meName: string
  target: { userId: string; name: string }
  onClose: () => void
}) {
  const [myPos, setMyPos] = useState<Coords | null>(null)
  const [targetPos, setTargetPos] = useState<Coords | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsCompass, setNeedsCompass] = useState(false)
  const myPosRef = useRef<Coords | null>(null)

  // Share my location + subscribe to the target's, over a Realtime channel.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Your device doesn't support location.")
      return
    }
    const supabase = createClient()
    const channel = supabase.channel(`event-locate:${eventId}`, {
      config: { presence: { key: meUserId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string; lat: number; lng: number }>()
        for (const entries of Object.values(state)) {
          const e = entries[0]
          if (e && e.userId === target.userId) {
            setTargetPos({ lat: e.lat, lng: e.lng })
          }
        }
      })
      .subscribe()

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        myPosRef.current = c
        setMyPos(c)
        // Broadcast my position to the shared channel.
        channel.track({ userId: meUserId, name: meName, lat: c.lat, lng: c.lng })
      },
      (err) => setError(err.message || "Couldn't get your location. Allow location access."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      supabase.removeChannel(channel)
    }
  }, [eventId, meUserId, meName, target.userId])

  // Device compass heading (best-effort; iOS needs an explicit permission tap).
  useEffect(() => {
    function onOrient(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
      const h = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null)
      if (h != null) setHeading(h)
    }
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    if (DOE && typeof DOE.requestPermission === "function") {
      setNeedsCompass(true) // iOS — wait for a user tap
    } else {
      window.addEventListener("deviceorientationabsolute", onOrient as EventListener, true)
      window.addEventListener("deviceorientation", onOrient as EventListener, true)
    }
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener, true)
      window.removeEventListener("deviceorientation", onOrient as EventListener, true)
    }
  }, [])

  async function enableCompass() {
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    try {
      const res = await DOE.requestPermission?.()
      if (res === "granted") {
        setNeedsCompass(false)
        window.addEventListener(
          "deviceorientation",
          ((e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
            const h = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null)
            if (h != null) setHeading(h)
          }) as EventListener,
          true
        )
      }
    } catch {
      setNeedsCompass(false)
    }
  }

  const distance = myPos && targetPos ? distanceMeters(myPos, targetPos) : null
  const bearing = myPos && targetPos ? bearingDeg(myPos, targetPos) : null
  // Arrow points toward the target relative to where the phone is facing.
  const arrowRotation = bearing != null ? bearing - (heading ?? 0) : 0
  const temp = distance != null ? temperature(distance) : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-white"
      style={{ background: temp?.bg ?? "rgba(2,6,23,0.96)" }}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 size-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
        aria-label="Stop finding"
      >
        <X className="size-5" />
      </button>

      <p className="text-sm text-white/70">Finding</p>
      <h2 className="text-2xl font-bold mb-8">{target.name}</h2>

      {error ? (
        <p className="text-center text-white/80 max-w-xs">{error}</p>
      ) : needsCompass ? (
        <Button variant="secondary" onClick={enableCompass} className="gap-2">
          <Compass className="size-4" /> Enable compass
        </Button>
      ) : !myPos ? (
        <div className="flex items-center gap-2 text-white/80">
          <Loader2 className="size-4 animate-spin" /> Getting your location…
        </div>
      ) : !targetPos ? (
        <div className="text-center space-y-2">
          <Loader2 className="size-5 animate-spin mx-auto" />
          <p className="text-white/80 max-w-xs text-sm">
            Waiting for {target.name} to open their finder too. Ask them to tap “Find” on you.
          </p>
        </div>
      ) : (
        <>
          {/* Compass arrow */}
          <motion.div
            animate={{ rotate: arrowRotation }}
            transition={{ type: "spring", stiffness: 90, damping: 15 }}
            className="mb-8"
          >
            <div className="size-40 rounded-full border-4 border-white/20 flex items-center justify-center">
              <Navigation className="size-20" fill="currentColor" />
            </div>
          </motion.div>

          <div className="text-center">
            <p className="text-5xl font-bold tabular-nums">{formatDistance(distance!)}</p>
            <p className="text-lg font-medium mt-2">{temp!.label}</p>
            {heading == null && (
              <p className="text-xs text-white/60 mt-3 max-w-xs">
                Tip: hold your phone flat and level for the arrow to point true.
              </p>
            )}
            <p className="text-[11px] text-white/50 mt-4 max-w-xs">
              Location is approximate (GPS). Shared only while this screen is open.
            </p>
          </div>
        </>
      )}
    </motion.div>
  )
}

function toRad(d: number) {
  return (d * Math.PI) / 180
}

function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function bearingDeg(a: Coords, b: Coords): number {
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

function temperature(m: number): { label: string; bg: string } {
  if (m < 3) return { label: "You found them! 🎉", bg: "rgba(16,185,129,0.95)" }
  if (m < 10) return { label: "Very warm 🔥", bg: "rgba(239,68,68,0.9)" }
  if (m < 25) return { label: "Warm", bg: "rgba(249,115,22,0.9)" }
  if (m < 60) return { label: "Getting closer", bg: "rgba(234,179,8,0.9)" }
  if (m < 150) return { label: "Cool", bg: "rgba(59,130,246,0.9)" }
  return { label: "Cold — keep looking", bg: "rgba(37,99,235,0.92)" }
}
