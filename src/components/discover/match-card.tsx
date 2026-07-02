"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Sparkles, UserPlus, MessageCircle, X, Check, Loader2, Navigation } from "lucide-react"
import type { RecommendationView } from "@/lib/actions/recommendations"
import { dismissRecommendation } from "@/lib/actions/recommendations"
import Link from "next/link"
import { sendConnectionRequest } from "@/lib/actions/connection"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CompatibilityRing, matchColor } from "./compatibility-ring"
import { useLocationShare } from "./location-share"
import { cn } from "@/lib/utils"

export function MatchCard({
  eventId,
  match,
  onRemoved,
  rank,
  online,
}: {
  eventId: string
  match: RecommendationView
  onRemoved: (userId: string) => void
  rank: number
  online: boolean
}) {
  const isTop = rank < 3
  const accent = matchColor(match.score)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const { find } = useLocationShare()

  const initials = match.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleConnect() {
    setConnecting(true)
    const result = await sendConnectionRequest(match.recommendedUserId, { eventId })
    setConnecting(false)
    if (!result.success) return toast.error(result.error)
    setConnected(true)
    toast.success(`Request sent to ${match.displayName} 🤝`)
  }

  async function handleDismiss() {
    onRemoved(match.recommendedUserId)
    await dismissRecommendation(eventId, match.recommendedUserId)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card
        className={cn("overflow-hidden relative transition-shadow", isTop && "border-transparent")}
        style={
          isTop
            ? { boxShadow: `0 0 0 2px ${accent}, 0 0 18px -2px ${accent}` }
            : undefined
        }
      >
        {isTop && (
          <div
            className="absolute top-0 right-0 text-[10px] font-bold text-white px-2 py-0.5 rounded-bl-lg z-10"
            style={{ backgroundColor: accent }}
          >
            🔥 TOP {rank + 1}
          </div>
        )}
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="size-14 border-2 border-background shadow-sm">
              <AvatarImage src={match.avatarUrl ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold leading-tight truncate">{match.displayName}</h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    online ? "bg-emerald-500" : "bg-rose-400"
                  )}
                />
                {online ? "Online" : "Offline"}
              </span>
              {match.headline && (
                <p className="text-sm text-muted-foreground truncate">{match.headline}</p>
              )}
              {match.sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {match.sharedInterests.slice(0, 3).map((i) => (
                    <Badge key={i} variant="violet" className="text-[10px]">
                      {i}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <CompatibilityRing score={match.score} />
          </div>

          {/* Why you should meet */}
          <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3 text-violet-500" />
              Why you should meet
            </div>
            <ul className="space-y-1">
              {match.reasons.map((r, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-violet-500 mt-1">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions — Find is primary; Connect + Chat are secondary */}
          <div className="flex items-center gap-2">
            <Button
              variant="gradient"
              className="flex-1"
              onClick={() => find({ userId: match.recommendedUserId, name: match.displayName })}
            >
              <Navigation className="size-4" /> Find
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleConnect}
              disabled={connected || connecting}
              aria-label={connected ? "Requested" : `Connect with ${match.displayName}`}
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : connected ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <UserPlus className="size-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" asChild aria-label={`Chat with ${match.displayName}`}>
              <Link href={`/messages/${match.recommendedUserId}`}>
                <MessageCircle className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Dismiss">
              <X className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
