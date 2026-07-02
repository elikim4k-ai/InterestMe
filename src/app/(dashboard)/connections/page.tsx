import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConnections } from "@/lib/actions/connection"
import { ConnectionsList } from "@/components/connections/connections-list"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Connections" }

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const result = await getConnections()
  const { incoming, accepted } = result.success
    ? result.data
    : { incoming: [], accepted: [] }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-muted-foreground">
          People who want to connect, and everyone you&apos;ve connected with
        </p>
      </div>

      <ConnectionsList incoming={incoming} accepted={accepted} />
    </div>
  )
}
