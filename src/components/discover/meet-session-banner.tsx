"use client"

import { motion } from "framer-motion"
import { Timer, PartyPopper, Users } from "lucide-react"
import { useMeetSession } from "./meet-session"
import { Button } from "@/components/ui/button"

/**
 * Shows the current conversation-timer session: who you're grouped with and the
 * shared countdown. When no session is active, offers a hint + a temporary test
 * timer so the countdown-end behavior can be previewed.
 */
export function MeetSessionBanner({ meUserId }: { meUserId: string }) {
  const { enabled, session, secondsLeft, expired, startTest, leave, expand } = useMeetSession()

  if (!enabled) return null

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`

  // No active conversation timer yet.
  if (!session) {
    return (
      <div className="rounded-2xl border bg-muted/30 p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <Timer className="size-4 inline mr-1.5 text-violet-500" />
          Meet someone via <span className="font-medium">Find</span>, then tap{" "}
          <span className="font-medium">“We connected”</span> to start a chat timer.
        </p>
        <Button size="sm" variant="outline" onClick={startTest} className="shrink-0">
          Test timer
        </Button>
      </div>
    )
  }

  const others = session.members.filter((m) => m.userId !== meUserId)
  const names =
    others.length === 0
      ? "yourself (test)"
      : others.length === 1
      ? others[0]!.name
      : `${others.slice(0, -1).map((m) => m.name).join(", ")} & ${others[others.length - 1]!.name}`

  if (expired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center justify-between gap-3"
      >
        <p className="text-sm font-medium flex items-center gap-1.5">
          <PartyPopper className="size-4 text-amber-500" />
          Time&apos;s up with {names}! Ready to meet someone new?
        </p>
        <Button size="sm" variant="gradient" onClick={leave} className="shrink-0">
          Done
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-300 dark:border-violet-800 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 p-4 flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="size-4 text-violet-500" />
          Chatting with {names}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {session.members.length} in this conversation
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-bold tabular-nums text-violet-600 dark:text-violet-400">
          {mmss}
        </span>
        <Button size="sm" variant="outline" onClick={expand}>
          Open
        </Button>
        <Button size="sm" variant="ghost" onClick={leave}>
          Done
        </Button>
      </div>
    </motion.div>
  )
}
