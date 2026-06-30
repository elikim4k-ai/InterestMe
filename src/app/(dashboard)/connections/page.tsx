import type { Metadata } from "next"
import { Users } from "lucide-react"

export const metadata: Metadata = { title: "Connections" }

export default function ConnectionsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-muted-foreground">People you&apos;ve met at events</p>
      </div>

      <div className="text-center py-24 space-y-4">
        <div className="text-5xl">🤝</div>
        <h2 className="text-lg font-semibold">No connections yet</h2>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm">
          Start attending events and connecting with people who share your interests.
        </p>
      </div>
    </div>
  )
}
