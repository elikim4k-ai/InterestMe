"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { useMeetSession, type Member } from "./meet-session"
import { Button } from "@/components/ui/button"

/**
 * Full-screen pulsing beacon so someone can spot you across a room. When it
 * carries the other person's identity, it also offers a "We connected" button
 * to start the shared conversation timer right from the flash.
 */
export function FlashBeacon({
  name,
  subtitle,
  connectWith,
  onDone,
}: {
  name: string
  subtitle: string
  connectWith?: Member
  onDone: () => void
}) {
  const { enabled, confirmMet } = useMeetSession()

  useEffect(() => {
    // Longer window when there's an action to take; brief otherwise.
    const t = setTimeout(onDone, connectWith ? 15000 : 6000)
    return () => clearTimeout(t)
  }, [onDone, connectWith])

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
          className="text-5xl font-black text-white drop-shadow-lg"
        >
          {name}
        </motion.p>
        <p className="mt-3 text-lg font-semibold text-white/90">{subtitle}</p>

        {enabled && connectWith && (
          <Button
            size="lg"
            className="mt-8 gap-2 bg-white text-slate-900 hover:bg-white/90"
            onClick={() => {
              confirmMet(connectWith)
              onDone()
            }}
          >
            <Check className="size-5" /> We connected — start timer
          </Button>
        )}

        <button onClick={onDone} className="mt-6 text-xs text-white/70 underline">
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}
