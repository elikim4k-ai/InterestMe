import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Calendar, MapPin, Users, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Events" }

export default async function EventsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Events I organize
  const { data: organizing } = await supabase
    .from("events")
    .select("id, name, slug, location, start_time, status, event_attendees(count)")
    .eq("organizer_id", user.id)
    .order("start_time", { ascending: false })

  // Events I'm attending
  const { data: attendingRows } = await supabase
    .from("event_attendees")
    .select("event:events(id, name, slug, location, start_time, status)")
    .eq("user_id", user.id)

  const attending = (attendingRows ?? [])
    .map((r) => r.event)
    .filter(Boolean)
    .filter(
      (e) =>
        !(organizing ?? []).some(
          (o) => o.id === (e as unknown as { id: string }).id
        )
    )

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">Manage and join networking events</p>
        </div>
        <Button size="sm" variant="gradient" asChild>
          <Link href="/events/new">
            <Plus className="size-4" />
            Create event
          </Link>
        </Button>
      </div>

      {/* Organizing */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Hosting
        </h2>
        {organizing && organizing.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {organizing.map((e) => (
              <EventCard
                key={e.id}
                href={`/events/${e.id}/manage`}
                name={e.name}
                location={e.location}
                startTime={e.start_time}
                status={e.status}
                attendeeCount={
                  (e.event_attendees as unknown as Array<{ count: number }>)?.[0]?.count ?? 0
                }
                isHost
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <div className="text-3xl">📅</div>
              <p className="text-sm text-muted-foreground">
                You&apos;re not hosting any events yet.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/events/new">Create your first event</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Attending */}
      {attending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Attending
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {attending.map((e) => {
              const ev = e as unknown as {
                id: string
                name: string
                slug: string
                location: string | null
                start_time: string
                status: string
              }
              return (
                <EventCard
                  key={ev.id}
                  // Attendees enter via the public join page, NOT /events/[id]
                  // (which redirects to the organizer-only manage view).
                  href={`/event/${ev.slug}`}
                  name={ev.name}
                  location={ev.location}
                  startTime={ev.start_time}
                  status={ev.status}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function EventCard({
  href,
  name,
  location,
  startTime,
  status,
  attendeeCount,
  isHost,
}: {
  href: string
  name: string
  location: string | null
  startTime: string
  status: string
  attendeeCount?: number
  isHost?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md hover:border-primary/30 transition-all h-full">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{name}</h3>
            <Badge variant={status === "PUBLISHED" || status === "ACTIVE" ? "emerald" : "secondary"}>
              {status}
            </Badge>
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {new Date(startTime).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {location}
              </span>
            )}
            {isHost && (
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {attendeeCount} attending
              </span>
            )}
          </div>

          {/* Visual CTA — a span (not a nested link/button) so it stays valid
              inside the wrapping Link; clicking anywhere on the card navigates. */}
          <span
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            {isHost ? "Manage event" : "Enter event"}
            <ArrowRight className="size-4" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
