import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Fetch profile for sidebar
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, onboarding_done")
    .eq("user_id", user.id)
    .single()

  // Redirect to onboarding if profile not completed
  if (!profile?.onboarding_done) {
    redirect("/onboarding")
  }

  const sidebarUser = {
    email: user.email ?? "",
    displayName: profile?.display_name ?? user.email ?? "User",
    avatarUrl: profile?.avatar_url ?? null,
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={sidebarUser} />
      <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
