"use client"

import { motion } from "framer-motion"

/** Animated circular compatibility score (0..1 → percentage ring). */
export function CompatibilityRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score)

  // Color shifts warmer as compatibility rises
  const color =
    pct >= 70 ? "rgb(139 92 246)" : pct >= 40 ? "rgb(99 102 241)" : "rgb(148 163 184)"

  return (
    <div className="relative size-14 shrink-0">
      <svg className="size-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
        />
        <motion.circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums">{pct}</span>
      </div>
    </div>
  )
}
