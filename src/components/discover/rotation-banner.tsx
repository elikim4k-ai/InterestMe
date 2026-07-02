"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Timer, Navigation, Coffee } from "lucide-react"
import { getCurrentRotation, type RotationState } from "@/lib/actions/rotation"
import { useLocationShare } from "./location-share"
import { Button } from "@/components/ui/button"

/**
 * Smart-rotation banner: when the organizer enabled networking rounds, shows the
 * current round, who to meet, and a live countdown to the next round. Refetches
 * the pairing when the round flips.
 */
export function RotationBanner({ eventId }: { eventId: string }) {
  const { find, signal } = useLocationShare()
  const [state, setState] = useState<RotationState | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const roundRef = useRef<number>(-1)

  const refetch = useCallback(async () => {
    const res = await getCurrentRotation(eventId)
    if (!res.success) return
    setState(res.data)
    setSecondsLeft(res.data.started ? res.data.secondsToNext : res.data.startsInSeconds)
    roundRef.current = res.data.round
  }, [eventId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Tick the countdown; refetch when it hits zero (new round / event start).
  useEffect(() => {
    if (!state?.enabled) return
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void refetch()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [state?.enabled, refetch])

  if (!state?.enabled) return null

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-300 dark:border-violet-800 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Timer className="size-4 text-violet-500" />
          {state.started ? (
            <>
              Round {state.round}
              {state.totalRounds > 0 && (
                <span className="text-muted-foreground font-normal">/ {state.totalRounds}</span>
              )}
            </>
          ) : (
            "Rounds start soon"
          )}
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {state.started ? `next in ${mmss}` : `starts in ${mmss}`}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!state.started ? (
          <p key="pre" className="text-sm text-muted-foreground mt-2">
            Networking rounds ({state.roundMinutes} min each) begin when the event starts.
          </p>
        ) : state.partner ? (
          <motion.div
            key={state.partner.userId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-between gap-3"
          >
            <p className="text-sm">
              Go meet{" "}
              <span className="font-semibold">{state.partner.name}</span> this round ✨
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => signal(state.partner!)}
              >
                Signal
              </Button>
              <Button
                size="sm"
                variant="gradient"
                onClick={() => find(state.partner!)}
              >
                <Navigation className="size-4" /> Find
              </Button>
            </div>
          </motion.div>
        ) : (
          <p key="bye" className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
            <Coffee className="size-4" />
            {state.bye
              ? "You're on a breather this round — grab a drink, back next round!"
              : "Waiting for more people to check in to start pairing."}
          </p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
