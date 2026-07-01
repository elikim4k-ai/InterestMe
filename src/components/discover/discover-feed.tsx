"use client"

import { useState, useTransition } from "react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { RefreshCw, Sparkles, Users } from "lucide-react"
import type { RecommendationView } from "@/lib/actions/recommendations"
import { generateEventRecommendations } from "@/lib/actions/recommendations"
import { syncAchievements } from "@/lib/actions/gamification"
import { Button } from "@/components/ui/button"
import { MatchCard } from "./match-card"
import { useEventPresence } from "@/hooks/use-event-presence"

export function DiscoverFeed({
  eventId,
  eventName,
  initialMatches,
  meName,
}: {
  eventId: string
  eventName: string
  initialMatches: RecommendationView[]
  meName: string
}) {
  const [matches, setMatches] = useState(initialMatches)
  const [refreshing, startRefresh] = useTransition()
  const { count: liveCount, people } = useEventPresence(eventId, { name: meName })
  const others = people.filter((p) => p.name !== meName)

  function removeMatch(userId: string) {
    setMatches((prev) => prev.filter((m) => m.recommendedUserId !== userId))
  }

  function refresh() {
    startRefresh(async () => {
      const result = await generateEventRecommendations(eventId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setMatches(result.data)
      // Viewing matches unlocks an achievement
      void syncAchievements({ viewedTopMatches: true }).then((r) => {
        if (r.success && r.data.length > 0) {
          for (const a of r.data) toast(`${a.emoji} ${a.name} unlocked! +${a.xpValue} XP`)
        }
      })
      toast.success("Matches refreshed ✨")
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Discover</h1>
            {liveCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {liveCount} here now
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-violet-500" />
            People you should meet at {eventName}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          Refresh
        </Button>
      </div>

      {/* Who's here right now */}
      {others.length > 0 && (
        <div className="rounded-2xl border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Here right now
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => (
              <div
                key={p.key}
                className="flex items-center gap-1.5 rounded-full bg-background border pl-1 pr-3 py-1"
              >
                <span className="size-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users className="size-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            No matches yet. As more people join and answer questions, your matches will appear here.
          </p>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className="size-4" /> Check again
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {matches.map((m) => (
              <MatchCard
                key={m.recommendedUserId}
                eventId={eventId}
                match={m}
                onRemoved={removeMatch}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
