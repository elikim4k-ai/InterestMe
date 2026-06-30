import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sparkles, Calendar, Users, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, headline")
    .eq("user_id", user.id)
    .single()

  const displayName = profile?.display_name?.split(" ")[0] ?? "there"

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Good {getGreeting()}, {displayName} 👋
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening in your network.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Connections", value: "0", icon: Users, color: "text-violet-600" },
          { label: "Events Attended", value: "0", icon: Calendar, color: "text-indigo-600" },
          { label: "Matches Found", value: "0", icon: Sparkles, color: "text-pink-600" },
          { label: "Profile Views", value: "0", icon: TrendingUp, color: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className={`${color} mb-3`}>
                <Icon className="size-5" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Complete profile nudge */}
        <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Complete your profile</CardTitle>
              <Badge variant="violet">New</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add your interests, projects, and goals to unlock AI-powered matches at your next event.
            </p>
            <Button asChild size="sm" variant="gradient">
              <Link href="/profile">Build my profile →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Join an event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Join an event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan a QR code at a networking event or enter the event link to connect with attendees.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/events">Browse events →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Empty state — recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-violet-600" />
              AI Recommendations
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl">🔮</div>
            <p className="font-medium">No recommendations yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Join an event and complete your profile to start receiving personalized match recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}
