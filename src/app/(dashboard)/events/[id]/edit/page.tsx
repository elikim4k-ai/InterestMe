import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { EditEventForm } from "@/components/events/edit-event-form"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Edit Event" }

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organizer_id, name, description, location, start_time, end_time, is_public, rotation_enabled, rotation_minutes"
    )
    .eq("id", id)
    .single()

  if (!event) notFound()
  if (event.organizer_id !== user.id) redirect("/events")

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <Link
          href={`/events/${id}/manage`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to event
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit event</h1>
          <p className="text-muted-foreground">Update your event details and settings.</p>
        </div>
      </div>

      <EditEventForm
        initial={{
          id: event.id,
          name: event.name ?? "",
          description: event.description ?? "",
          location: event.location ?? "",
          startTime: event.start_time ?? "",
          endTime: event.end_time ?? "",
          isPublic: event.is_public ?? true,
          rotationEnabled: event.rotation_enabled ?? false,
          rotationMinutes: event.rotation_minutes ?? 15,
        }}
      />
    </div>
  )
}
