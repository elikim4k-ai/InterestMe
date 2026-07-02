import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Calendar, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { generateEventQr, eventJoinUrl } from "@/lib/qr"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase.from("events").select("name").eq("slug", slug).single()
  return { title: event?.name ? `${event.name} — Scan to Join` : "Scan to Join" }
}

/**
 * Full-screen kiosk/projector view: big event title + description, a large QR
 * code, and a bold "SCAN TO JOIN!" call-to-action. Public (no auth) so it can
 * be displayed on any screen.
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from("events")
    .select("name, description, location, start_time, status")
    .eq("slug", slug)
    .single()

  if (!event) notFound()

  const qr = await generateEventQr(slug)
  const joinUrl = eventJoinUrl(slug)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-10 bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 text-white">
      <div className="flex items-center gap-2 text-white/80 font-semibold tracking-wide mb-6">
        <span>✦</span> InterestMe
      </div>

      <h1 className="text-4xl sm:text-6xl font-black leading-tight max-w-4xl">
        {event.name}
      </h1>

      {event.description && (
        <p className="mt-4 text-lg sm:text-2xl text-white/85 max-w-2xl">{event.description}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-white/80 text-base sm:text-lg">
        <span className="flex items-center gap-2">
          <Calendar className="size-5" />
          {new Date(event.start_time).toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {event.location && (
          <span className="flex items-center gap-2">
            <MapPin className="size-5" />
            {event.location}
          </span>
        )}
      </div>

      {/* Big QR */}
      <div className="mt-10 bg-white rounded-3xl p-6 shadow-2xl">
        <Image
          src={qr}
          alt="Scan to join"
          width={460}
          height={460}
          unoptimized
          priority
          className="w-[min(70vw,460px)] h-auto"
        />
      </div>

      <p className="mt-8 text-3xl sm:text-5xl font-black tracking-tight animate-pulse">
        📲 SCAN TO JOIN!
      </p>
      <p className="mt-3 text-white/70 text-sm sm:text-base break-all">{joinUrl}</p>
    </div>
  )
}
