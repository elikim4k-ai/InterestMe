"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Navigation, X, Compass, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocationShare, type Coords } from "./location-share"

/**
 * "Warmer / colder" finder. Reads live positions from LocationShareProvider
 * (both people are sharing while on Discover) and shows approximate distance +
 * a compass arrow toward the target. Indoor GPS is coarse (~5–15m), so this is
 * a playful treasure-hunt, not precise navigation.
 */
export function FindOverlay({
  target,
  onClose,
}: {
  target: { userId: string; name: string }
  onClose: () => void
}) {
  const { myCoords, positions, error, enable } = useLocationShare()
  const [heading, setHeading] = useState<number | null>(null)
  const [needsCompass, setNeedsCompass] = useState(false)

  const targetPos = positions.get(target.userId) ?? null

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

  const distance = myCoords && targetPos ? distanceMeters(myCoords, targetPos) : null
  const bearing = myCoords && targetPos ? bearingDeg(myCoords, targetPos) : null
  const arrowRotation = bearing != null ? bearing - (heading ?? 0) : 0
  const temp = distance != null ? temperature(distance) : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 text-white"
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

      {error === "denied" ? (
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-white/80 text-sm">
            Location is off. Enable it to find people.
          </p>
          <Button variant="secondary" onClick={enable}>
            Enable location
          </Button>
        </div>
      ) : error ? (
        <p className="text-center text-white/80 max-w-xs text-sm">{error}</p>
      ) : needsCompass ? (
        <div className="text-center space-y-2">
          <Button variant="secondary" onClick={enableCompass} className="gap-2">
            <Compass className="size-4" /> Enable compass
          </Button>
          <p className="text-xs text-white/60">Lets the arrow point the right way.</p>
        </div>
      ) : !myCoords ? (
        <div className="flex items-center gap-2 text-white/80">
          <Loader2 className="size-4 animate-spin" /> Getting your location…
        </div>
      ) : !targetPos ? (
        <div className="text-center space-y-2">
          <Loader2 className="size-5 animate-spin mx-auto" />
          <p className="text-white/80 max-w-xs text-sm">
            Waiting for {target.name} to open Discover so their location is live.
          </p>
        </div>
      ) : (
        <>
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
                Hold your phone flat and level for the arrow to point true.
              </p>
            )}
            <p className="text-[11px] text-white/50 mt-4 max-w-xs">
              Location is approximate (GPS), shared only while you&apos;re on Discover.
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
