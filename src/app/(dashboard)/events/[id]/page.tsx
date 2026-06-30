import { redirect } from "next/navigation"

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // For now, organizers land on manage. Attendee detail view comes in Phase 3.
  redirect(`/events/${id}/manage`)
}
