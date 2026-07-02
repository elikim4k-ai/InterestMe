import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getMessages } from "@/lib/actions/message"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChatRoom } from "@/components/messages/chat-room"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Chat" }

export default async function ChatPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId: otherUserId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: other } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, headline")
    .eq("user_id", otherUserId)
    .single()

  const messagesResult = await getMessages(otherUserId)
  const initialMessages = messagesResult.success ? messagesResult.data : []

  const name = other?.display_name ?? "Chat"
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-2xl mx-auto flex items-center gap-3 mb-2">
        <Link href="/connections" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar className="size-9">
          <AvatarImage src={other?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-semibold leading-tight">{name}</h1>
          {other?.headline && (
            <p className="text-xs text-muted-foreground">{other.headline}</p>
          )}
        </div>
      </div>

      <ChatRoom
        meUserId={user.id}
        otherUserId={otherUserId}
        otherName={name}
        initialMessages={initialMessages}
      />
    </div>
  )
}
