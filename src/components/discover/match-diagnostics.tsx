"use client"

import { useState } from "react"
import { Loader2, Bug } from "lucide-react"
import { getMatchDebug, type MatchDebug } from "@/lib/actions/match-debug"
import { Button } from "@/components/ui/button"

/** Small on-demand diagnostic so match issues are visible without server logs. */
export function MatchDiagnostics({ eventId }: { eventId: string }) {
  const [data, setData] = useState<MatchDebug | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    const res = await getMatchDebug(eventId)
    setLoading(false)
    if (res.success) setData(res.data)
  }

  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Bug className="size-4" />}
        Why no matches?
      </Button>

      {data && (
        <div className="mt-3 mx-auto max-w-sm text-left rounded-xl border bg-muted/30 p-3 text-xs space-y-1 font-mono">
          <Row k="AI provider" v={`${data.provider} (${data.isLive ? "live" : "fallback"})`} />
          <Row k="Attendees at event" v={String(data.attendees)} />
          <Row k="Others visible to you" v={String(data.others)} />
          <Row k="Matches computed" v={String(data.matchCount)} />
          <Row k="Engine" v={data.engineResult} />
          {data.topReason && <Row k="Top reason" v={data.topReason} />}
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right break-all">{v}</span>
    </div>
  )
}
