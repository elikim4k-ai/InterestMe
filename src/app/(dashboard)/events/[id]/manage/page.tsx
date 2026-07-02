import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Calendar, MapPin, Users, Pencil, Monitor } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { generateEventQr, eventJoinUrl } from "@/lib/qr"
import { getEventAnalytics } from "@/lib/actions/analytics"
import { BarList } from "@/components/analytics/charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CopyLinkButton } from "@/components/events/copy-link-button"
import { DeleteEventButton } from "@/components/events/delete-event-button"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Manage Event" }

export default async function ManageEventPage({
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
      "*, event_questions(id, text, type, is_required, order), event_attendees(id, status, checked_in_at, user_id)"
    )
    .eq("id", id)
    .single()

  if (!event) notFound()
  if (event.organizer_id !== user.id) redirect("/events")

  const qrDataUrl = await generateEventQr(event.slug)
  const joinUrl = eventJoinUrl(event.slug)
  const analyticsResult = await getEventAnalytics(id)
  const analytics = analyticsResult.success ? analyticsResult.data : null

  const attendees = event.event_attendees ?? []
  const checkedIn = attendees.filter(
    (a: { status: string }) => a.status === "CHECKED_IN"
  ).length

  // Fetch attendee profiles
  const userIds = attendees.map((a: { user_id: string }) => a.user_id)
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, headline")
        .in("user_id", userIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string }) => [p.user_id, p])
  )

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to events
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <Badge variant={event.status === "PUBLISHED" ? "emerald" : "secondary"}>
              {event.status}
            </Badge>
          </div>
          {event.description && (
            <p className="text-muted-foreground max-w-xl">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" />
              {new Date(event.start_time).toLocaleString()}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              {attendees.length} registered · {checkedIn} checked in
            </span>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${event.id}/edit`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/event/${event.slug}/present`} target="_blank" rel="noopener noreferrer">
              <Monitor className="size-4" /> Present
            </a>
          </Button>
          <DeleteEventButton eventId={event.id} eventName={event.name} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* QR Code */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Event QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
              <Image
                src={qrDataUrl}
                alt="Event QR code"
                width={256}
                height={256}
                className="w-full max-w-[256px] h-auto"
                unoptimized
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Attendees scan this to join instantly
            </p>
            <CopyLinkButton url={joinUrl} />
          </CardContent>
        </Card>

        {/* Attendees */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Attendees ({attendees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {attendees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No attendees yet. Share the QR code to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {attendees.map((a: { id: string; user_id: string; status: string }) => {
                  const p = profileMap.get(a.user_id) as
                    | { display_name: string; avatar_url: string | null; headline: string | null }
                    | undefined
                  const name = p?.display_name ?? "Attendee"
                  const initials = name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={p?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {p?.headline && (
                          <p className="text-xs text-muted-foreground truncate">{p.headline}</p>
                        )}
                      </div>
                      <Badge
                        variant={a.status === "CHECKED_IN" ? "emerald" : "secondary"}
                        className="text-[10px]"
                      >
                        {a.status === "CHECKED_IN" ? "Checked in" : "Registered"}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event insights */}
      {analytics && (
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check-in rate</span>
                <span className="font-bold tabular-nums">{analytics.checkInRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Answers submitted</span>
                <span className="font-bold tabular-nums">{analytics.answersSubmitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connections made</span>
                <span className="font-bold tabular-nums">{analytics.connectionsMade}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Top interests in the room</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList
                data={analytics.topInterests.map((i) => ({ label: i.name, value: i.count }))}
                emptyLabel="Interests will appear as attendees complete their profiles."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Questions preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Event questions ({event.event_questions?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {(event.event_questions ?? [])
              .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
              .map((q: { id: string; text: string; is_required: boolean }, i: number) => (
                <li key={q.id} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{q.text}</span>
                  {q.is_required && (
                    <Badge variant="outline" className="text-[10px]">
                      Required
                    </Badge>
                  )}
                </li>
              ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
