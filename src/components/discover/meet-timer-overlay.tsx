"use client"

import { motion } from "framer-motion"
import { Minus, PartyPopper } from "lucide-react"
import { useMeetSession } from "./meet-session"
import { Button } from "@/components/ui/button"

/**
 * Full-screen conversation timer shown to everyone in a meet group. Minimal by
 * design — just the shared countdown, who you're with, and controls.
 */
export function MeetTimerOverlay() {
  const { session, secondsLeft, expired, leave, minimize } = useMeetSession()
  if (!session) return null

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
  const names = session.members.map((m) => m.name).join(" · ")

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[65] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white"
    >
      {/* Minimize (keep chatting, timer runs in the banner) */}
      <button
        onClick={minimize}
        className="absolute top-5 right-5 size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        aria-label="Minimize timer"
      >
        <Minus className="size-5" />
      </button>

      <p className="text-sm uppercase tracking-widest text-white/60">
        {session.members.length > 1 ? "Conversation" : "Test timer"}
      </p>
      <p className="mt-2 text-lg font-medium text-white/90 max-w-md">{names}</p>

      {expired ? (
        <div className="mt-10 space-y-4">
          <p className="text-4xl font-black flex items-center justify-center gap-2">
            <PartyPopper className="size-9 text-amber-400" /> Time&apos;s up!
          </p>
          <p className="text-white/70">Great chat — ready to meet someone new?</p>
          <Button size="lg" variant="gradient" onClick={leave}>
            Done — find someone new
          </Button>
        </div>
      ) : (
        <>
          <motion.p
            key={mmss}
            initial={{ scale: 0.98, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-8 text-8xl font-black tabular-nums"
          >
            {mmss}
          </motion.p>
          <p className="mt-3 text-white/60">left in this conversation</p>
          <Button variant="outline" onClick={leave} className="mt-10 border-white/30 text-white hover:bg-white/10">
            End early
          </Button>
        </>
      )}
    </motion.div>
  )
}
