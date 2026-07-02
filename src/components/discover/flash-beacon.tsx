"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

/**
 * Full-screen pulsing beacon so someone can spot you across a room. Shows the
 * screen owner's name (for others to identify) plus who they're pairing with.
 * When actionable, offers a "We connected" button (synced to the other person)
 * and a clearly-legible dismiss.
 */
export function FlashBeacon({
  name,
  subtitle,
  canConnect,
  onConnect,
  onDismiss,
  onExpire,
}: {
  name: string
  subtitle: string
  canConnect: boolean
  onConnect: () => void
  onDismiss: () => void
  onExpire: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onExpire, canConnect ? 15000 : 6000)
    return () => clearTimeout(t)
  }, [onExpire, canConnect])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center text-center p-6"
    >
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: ["#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative flex flex-col items-center">
        <motion.p
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-5xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        >
          {name}
        </motion.p>
        <p className="mt-3 text-lg font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
          {subtitle}
        </p>

        {canConnect && (
          <button
            onClick={onConnect}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-slate-900 shadow-lg"
          >
            <Check className="size-5" /> We connected — start timer
          </button>
        )}

        <button
          onClick={onDismiss}
          className="mt-6 rounded-full bg-black/40 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}
