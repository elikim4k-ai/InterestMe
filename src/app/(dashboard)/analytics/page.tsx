import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Users, Calendar, Sparkles, Trophy, Heart, Target } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getPersonalAnalytics } from "@/lib/actions/analytics"
import { getGraphInsights } from "@/lib/actions/knowledge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatTile, BarList, MiniBars } from "@/components/analytics/charts"
import { GraphInsightsPanel } from "@/components/analytics/graph-insights"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Analytics" }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [analyticsResult, insightsResult] = await Promise.all([
    getPersonalAnalytics(),
    getGraphInsights(),
  ])

  const a = analyticsResult.success
    ? analyticsResult.data
    : {
        eventsAttended: 0,
        connectionsMade: 0,
        interestsCount: 0,
        projectsCount: 0,
        goalsCount: 0,
        achievementsUnlocked: 0,
        totalXp: 0,
        connectionsByEvent: [],
        networkInterests: [],
        weeklyActivity: [],
      }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Analytics</h1>
        <p className="text-muted-foreground">How your network and identity are growing</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Connections" value={a.connectionsMade} icon={<Users className="size-5" />} accent="violet" />
        <StatTile label="Events attended" value={a.eventsAttended} icon={<Calendar className="size-5" />} accent="blue" />
        <StatTile label="Total XP" value={a.totalXp} icon={<Sparkles className="size-5" />} accent="pink" />
        <StatTile label="Achievements" value={a.achievementsUnlocked} icon={<Trophy className="size-5" />} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* AI insights */}
        {insightsResult.success && <GraphInsightsPanel insights={insightsResult.data} />}

        {/* Weekly activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Networking activity</CardTitle>
          </CardHeader>
          <CardContent>
            {a.weeklyActivity.length > 0 ? (
              <MiniBars data={a.weeklyActivity.map((w) => ({ label: w.week, value: w.count }))} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Make connections to see your activity over time.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Network interests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="size-4 text-pink-500" />
              Your network&apos;s interests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              data={a.networkInterests.map((i) => ({ label: i.name, value: i.count }))}
              emptyLabel="Connect with people to map your network's interests."
            />
          </CardContent>
        </Card>

        {/* Connections by event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4 text-violet-500" />
              Where you connect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              data={a.connectionsByEvent.map((e) => ({ label: e.eventName, value: e.count }))}
              emptyLabel="Your connections by event will appear here."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
