import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Calendar, MapPin, Users, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EventJoinPanel } from "@/components/events/event-join-panel"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from("events")
    .select("name, description")
    .eq("slug", slug)
    .single()

  return {
    title: event?.name ?? "Join Event",
    description: event?.description ?? "Join this event on InterestMe",
  }
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, slug, description, location, start_time, end_time, status, is_public, event_questions(id, text, type, options, is_required, placeholder, order), event_attendees(count)"
    )
    .eq("slug", slug)
    .single()

  if (!event) notFound()
  if (event.status === "CANCELLED") {
    return (
      <CenteredMessage emoji="🚫" title="Event cancelled">
        This event is no longer available.
      </CenteredMessage>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const attendeeCount =
    (event.event_attendees as unknown as Array<{ count: number }>)?.[0]?.count ?? 0

  const questions = (event.event_questions ?? []).sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  )

  // If logged out, show event preview + sign-in CTA
  if (!user) {
    return (
      <PublicShell>
        <EventHeader
          name={event.name}
          description={event.description}
          location={event.location}
          startTime={event.start_time}
          attendeeCount={attendeeCount}
        />
        <div className="space-y-3">
          <Button size="lg" variant="gradient" className="w-full" asChild>
            <Link href={`/login?redirectTo=/event/${slug}`}>Sign in to join</Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link href={`/signup?redirectTo=/event/${slug}`}>Create a free account</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {questions.length} questions · Takes ~2 minutes
          </p>
        </div>
      </PublicShell>
    )
  }

  // Logged in but no profile → onboarding first
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, onboarding_done")
    .eq("user_id", user.id)
    .single()

  if (!profile?.onboarding_done) {
    redirect(`/onboarding?redirectTo=/event/${slug}`)
  }

  // Existing attendance + answers
  const { data: attendee } = await supabase
    .from("event_attendees")
    .select("id, status, event_answers(question_id, answer)")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const existingAnswers: Record<string, string> = {}
  if (attendee?.event_answers) {
    for (const a of attendee.event_answers as Array<{ question_id: string; answer: string }>) {
      existingAnswers[a.question_id] = a.answer
    }
  }

  return (
    <PublicShell>
      <EventHeader
        name={event.name}
        description={event.description}
        location={event.location}
        startTime={event.start_time}
        attendeeCount={attendeeCount}
      />
      <EventJoinPanel
        eventId={event.id}
        eventSlug={slug}
        alreadyJoined={!!attendee}
        checkedIn={attendee?.status === "CHECKED_IN"}
        questions={questions}
        existingAnswers={existingAnswers}
      />
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span>✦</span> InterestMe
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">{children}</main>
    </div>
  )
}

function EventHeader({
  name,
  description,
  location,
  startTime,
  attendeeCount,
}: {
  name: string
  description: string | null
  location: string | null
  startTime: string
  attendeeCount: number
}) {
  return (
    <div className="space-y-4">
      <Badge variant="violet" className="gap-1">
        <Sparkles className="size-3" /> Networking event
      </Badge>
      <h1 className="text-3xl font-bold">{name}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-4" />
          {new Date(startTime).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" />
            {location}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {attendeeCount} attending
        </span>
      </div>
    </div>
  )
}

function CenteredMessage({
  emoji,
  title,
  children,
}: {
  emoji: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="space-y-3">
        <div className="text-5xl">{emoji}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{children}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
