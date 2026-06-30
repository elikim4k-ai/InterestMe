import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Edit, MapPin, Globe, Linkedin } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "My Profile" }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, profile_interests(interests(name, emoji)), goals(text)")
    .eq("user_id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const initials = profile.display_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <Edit className="size-4" />
            Edit profile
          </Link>
        </Button>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="size-20 text-2xl">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h2 className="text-xl font-bold">{profile.display_name}</h2>
                {profile.headline && (
                  <p className="text-muted-foreground">{profile.headline}</p>
                )}
              </div>
              {profile.bio && (
                <p className="text-sm leading-relaxed">{profile.bio}</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Globe className="size-3.5" />
                    Website
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Linkedin className="size-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interests</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.profile_interests?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.profile_interests.map(({ interests }: { interests: { name: string; emoji: string | null } }) => (
                <Badge key={interests.name} variant="violet" className="gap-1 text-sm py-1 px-3">
                  {interests.emoji} {interests.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No interests added yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.goals?.length > 0 ? (
            <ul className="space-y-2">
              {profile.goals.map(({ text }: { text: string }, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-violet-600 mt-0.5">✦</span>
                  {text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No goals added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
