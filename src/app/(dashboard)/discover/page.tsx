import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getMyRecommendations } from "@/lib/actions/recommendations"
import { getAIProvider } from "@/lib/ai/provider"
import { Button } from "@/components/ui/button"
import { DiscoverFeed } from "@/components/discover/discover-feed"
import { SaveAccountBanner } from "@/components/shared/save-account-banner"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Discover" }

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const { event: eventParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Resolve the active event: query param, else most recent attendance
  let eventId = eventParam
  if (!eventId) {
    const { data: recent } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    eventId = recent?.event_id
  }

  if (!eventId) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="text-center py-20 space-y-4">
          <Sparkles className="size-12 mx-auto text-violet-500" />
          <h1 className="text-2xl font-bold">Discover people</h1>
          <p className="text-muted-foreground">
            Join an event to start discovering people you should meet.
          </p>
          <Button variant="gradient" asChild>
            <Link href="/events">Browse events</Link>
          </Button>
        </div>
      </div>
    )
  }

  const [{ data: event }, { data: myProfile }, otherAttendeesResult, recsResult] =
    await Promise.all([
      supabase.from("events").select("name").eq("id", eventId).single(),
      supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
      // How many OTHER attendees are visible to me (respects RLS — exactly what
      // the match engine can see). A key diagnostic: 0 here means matching can't
      // work regardless of the AI provider.
      supabase
        .from("event_attendees")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .neq("user_id", user.id),
      getMyRecommendations(eventId),
    ])

  const matches = recsResult.success ? recsResult.data : []
  const otherAttendees = otherAttendeesResult.count ?? 0

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      {user.is_anonymous && <SaveAccountBanner />}
      <DiscoverFeed
        eventId={eventId}
        eventName={event?.name ?? "this event"}
        initialMatches={matches}
        meName={myProfile?.display_name ?? "You"}
        meUserId={user.id}
        aiActive={getAIProvider().isLive}
        otherAttendees={otherAttendees}
      />
    </div>
  )
}
