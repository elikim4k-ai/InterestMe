"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/** Horizontal bar list — for "top interests", "connections by event", etc. */
export function BarList({
  data,
  emptyLabel = "No data yet",
}: {
  data: { label: string; value: number }[]
  emptyLabel?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{emptyLabel}</p>
  }
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{d.label}</span>
            <span className="text-muted-foreground tabular-nums">{d.value}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Vertical mini bar chart — for weekly activity. */
export function MiniBars({
  data,
}: {
  data: { label: string; value: number }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end justify-between gap-1.5 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full flex-1 flex items-end">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className={cn(
                "w-full rounded-md min-h-[2px]",
                d.value > 0
                  ? "bg-gradient-to-t from-violet-500 to-indigo-400"
                  : "bg-muted"
              )}
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Big stat tile. */
export function StatTile({
  label,
  value,
  icon,
  accent = "violet",
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  accent?: "violet" | "pink" | "amber" | "emerald" | "blue"
}) {
  const accents: Record<string, string> = {
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-500",
    pink: "bg-pink-100 dark:bg-pink-950/40 text-pink-500",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-500",
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-500",
    blue: "bg-blue-100 dark:bg-blue-950/40 text-blue-500",
  }
  return (
    <div className="rounded-2xl border p-4 flex items-center gap-3">
      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", accents[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}
