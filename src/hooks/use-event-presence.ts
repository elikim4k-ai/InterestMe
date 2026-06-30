"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Tracks how many attendees are currently active on an event's discover page
 * using Supabase Realtime presence. Returns a live count.
 */
export function useEventPresence(eventId: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const channel = supabase.channel(`event-presence:${eventId}`, {
      config: { presence: { key: crypto.randomUUID() } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [eventId])

  return count
}
