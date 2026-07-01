"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { deleteEvent } from "@/lib/actions/event"
import { Button } from "@/components/ui/button"

/**
 * Two-step delete: first click arms the confirmation, second confirms. Available
 * to whoever created the event (organizer_id === current user), guests included.
 */
export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: string
  eventName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteEvent(eventId)
    if (!result.success) {
      setDeleting(false)
      setConfirming(false)
      toast.error(result.error)
      return
    }
    toast.success(`Deleted "${eventName}"`)
    router.push("/events")
    router.refresh()
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive hover:border-destructive/50"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" />
        Delete event
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">Delete this event?</span>
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
        {deleting ? <Loader2 className="size-4 animate-spin" /> : "Yes, delete"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
        Cancel
      </Button>
    </div>
  )
}
