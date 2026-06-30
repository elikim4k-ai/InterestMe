"use client"

import { motion } from "framer-motion"
import { Lock } from "lucide-react"
import type { BadgeView } from "@/lib/actions/gamification"
import { cn } from "@/lib/utils"

export function BadgeGrid({ badges }: { badges: BadgeView[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          className={cn(
            "relative rounded-2xl border p-4 text-center transition-all",
            badge.unlocked
              ? "bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-violet-200 dark:border-violet-800"
              : "bg-muted/30 border-dashed opacity-60"
          )}
        >
          <div className={cn("text-3xl mb-1.5", !badge.unlocked && "grayscale")}>
            {badge.unlocked ? badge.emoji : <Lock className="size-7 mx-auto text-muted-foreground" />}
          </div>
          <p className="text-sm font-semibold leading-tight">{badge.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
          {badge.unlocked && (
            <span className="absolute top-2 right-2 text-[10px] font-bold text-violet-600 dark:text-violet-400">
              +{badge.xpValue}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  )
}
