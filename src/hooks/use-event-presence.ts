"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface PresentPerson {
  key: string
  name: string
}

/**
 * Tracks who is currently active on an event's discover page via Supabase
 * Realtime presence. Returns the live list of people (with names) and a count.
 * Pass the current user's name so they show up to others.
 */
export function useEventPresence(
  eventId: string,
  me?: { name: string }
): { count: number; people: PresentPerson[]; selfKey: string } {
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
        const state = channel.presenceState<{ name: string }>()
        const list: PresentPerson[] = Object.entries(state).map(([key, entries]) => ({
          key,
          name: entries[0]?.name ?? "Guest",
        }))
        setPeople(list)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: me?.name ?? "Guest", online_at: new Date().toISOString() })
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [eventId, me?.name, selfKey])

  return { count: people.length, people, selfKey }
}
