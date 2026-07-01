"use client"

import { motion } from "framer-motion"

/** Heatmap color for a match score: red (hot) → orange → yellow (cooler). */
export function matchColor(score: number): string {
  const s = Math.max(0, Math.min(1, score))
  // hue 0 (red) at score 1 → hue 55 (yellow) at score 0
  const hue = 55 * (1 - s)
  return `hsl(${hue}, 92%, 52%)`
}

/** Animated circular compatibility score with a "Match" caption. */
export function CompatibilityRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score)
  const color = matchColor(score)

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative size-14">
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
          <span className="text-sm font-bold tabular-nums" style={{ color }}>
            {pct}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Match</span>
    </div>
  )
}
