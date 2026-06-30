import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EventForm } from "@/components/events/event-form"

export const metadata: Metadata = { title: "Create Event" }

export default function NewEventPage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to events
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create an event</h1>
          <p className="text-muted-foreground">
            Set up your networking event and custom questions.
          </p>
        </div>
      </div>
      <EventForm />
    </div>
  )
}
