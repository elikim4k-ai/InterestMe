import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Network } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getMyKnowledgeGraph } from "@/lib/actions/knowledge"
import { Button } from "@/components/ui/button"
import { MindMap } from "@/components/mindmap/mind-map"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Mind Map" }

export default async function MindMapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const result = await getMyKnowledgeGraph()
  const graph = result.success ? result.data : { nodes: [], links: [] }

  // Only the root node → nothing to explore yet
  if (graph.nodes.length <= 1) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="text-center py-20 space-y-4">
          <Network className="size-12 mx-auto text-violet-500" />
          <h1 className="text-2xl font-bold">Your mind map is taking shape</h1>
          <p className="text-muted-foreground">
            Add interests, projects, and goals — then attend events and make connections.
            Everything you do grows your living knowledge graph.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="gradient" asChild>
              <Link href="/settings">Add to your profile</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/events">Browse events</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <MindMap graph={graph} />
    </div>
  )
}
