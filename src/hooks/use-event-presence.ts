"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface PresentPerson {
  key: string
  userId: string
  name: string
}

/**
 * Tracks who is currently active on an event's discover page via Supabase
 * Realtime presence. Returns the live list of people (with names) and a count.
 * Pass the current user's name so they show up to others.
 */
export function useEventPresence(
  eventId: string,
  me?: { userId: string; name: string }
): { count: number; people: PresentPerson[]; selfKey: string; onlineIds: Set<string> } {
  const [people, setPeople] = useState<PresentPerson[]>([])
  const [selfKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const myKey = selfKey

    const channel = supabase.channel(`event-presence:${eventId}`, {
      config: { presence: { key: myKey } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return
        const state = channel.presenceState<{ userId: string; name: string }>()
        const list: PresentPerson[] = Object.entries(state).map(([key, entries]) => ({
          key,
          userId: entries[0]?.userId ?? "",
          name: entries[0]?.name ?? "Guest",
        }))
        setPeople(list)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: me?.userId ?? "",
            name: me?.name ?? "Guest",
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [eventId, me?.userId, me?.name, selfKey])

  const onlineIds = new Set(people.map((p) => p.userId).filter(Boolean))
  return { count: people.length, people, selfKey, onlineIds }
}
