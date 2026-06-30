import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Trophy, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getMyBadges } from "@/lib/actions/gamification"
import { BadgeGrid } from "@/components/gamification/badge-grid"
import { Card, CardContent } from "@/components/ui/card"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Achievements" }

export default async function AchievementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const result = await getMyBadges()
  const { badges, totalXp, unlockedCount } = result.success
    ? result.data
    : { badges: [], totalXp: 0, unlockedCount: 0 }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="size-6 text-amber-500" />
          Achievements
        </h1>
        <p className="text-muted-foreground">Earn badges as you network and explore</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="size-11 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Trophy className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {unlockedCount}
                <span className="text-sm text-muted-foreground font-normal">/{badges.length}</span>
              </p>
              <p className="text-xs text-muted-foreground">Badges earned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="size-11 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <Zap className="size-5 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{totalXp}</p>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BadgeGrid badges={badges} />
    </div>
  )
}
