import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileEditor } from "@/components/profile/profile-editor"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, headline, bio, location, website, linkedin_url, instagram_url, github_url, profile_interests(interests(name)), goals(text)"
    )
    .eq("user_id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const initial = {
    displayName: profile.display_name ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    website: profile.website ?? "",
    linkedinUrl: profile.linkedin_url ?? "",
    instagramUrl: profile.instagram_url ?? "",
    githubUrl: profile.github_url ?? "",
  }

  const initialInterests = (
    (profile.profile_interests ?? []) as unknown as Array<{
      interests: { name: string } | { name: string }[] | null
    }>
  )
    .map((pi) => (Array.isArray(pi.interests) ? pi.interests[0]?.name : pi.interests?.name))
    .filter((n): n is string => Boolean(n))
  const initialGoals = (
    (profile.goals ?? []) as Array<{ text: string }>
  ).map((g) => g.text)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>
      <ProfileEditor
        initial={initial}
        initialInterests={initialInterests}
        initialGoals={initialGoals}
      />
    </div>
  )
}
