"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"

/**
 * Full-screen pulsing beacon so someone can spot you across a room — the
 * web-friendly answer to GPS's last-few-meters problem. Auto-dismisses.
 */
export function FlashBeacon({
  name,
  subtitle,
  onDone,
}: {
  name: string
  subtitle: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.button
      onClick={onDone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center text-center p-6"
    >
      {/* Rapidly cycling bright background — highly visible from a distance */}
      <motion.div
        className="absolute inset-0"
        animate={{
          backgroundColor: [
            "#ec4899",
            "#f59e0b",
            "#10b981",
            "#3b82f6",
            "#ec4899",
          ],
        }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative">
        <motion.p
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-5xl font-black text-white drop-shadow-lg"
        >
          {name}
        </motion.p>
        <p className="mt-3 text-lg font-semibold text-white/90">{subtitle}</p>
        <p className="mt-8 text-xs text-white/70">Tap anywhere to dismiss</p>
      </div>
    </motion.button>
  )
}
