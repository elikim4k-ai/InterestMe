"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Send, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { sendMessage, type ChatMessage } from "@/lib/actions/message"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ChatRoom({
  meUserId,
  otherUserId,
  otherName,
  initialMessages,
}: {
  meUserId: string
  otherUserId: string
  otherName: string
  initialMessages: ChatMessage[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pairKey = [meUserId, otherUserId].sort().join("_")

  // Realtime: receive the other person's messages as they send them.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`chat:${pairKey}`)
    channel
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        const m = payload as ChatMessage
        if (m.senderId === otherUserId) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [pairKey, otherUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText("")
    const result = await sendMessage(otherUserId, content)
    setSending(false)
    if (!result.success) {
      toast.error(result.error)
      setText(content)
      return
    }
    setMessages((prev) => [...prev, result.data])
    // Broadcast to the other participant's open room.
    const supabase = createClient()
    const channel = supabase.channel(`chat:${pairKey}`)
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({ type: "broadcast", event: "msg", payload: result.data })
        setTimeout(() => supabase.removeChannel(channel), 500)
      }
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            Say hi to {otherName} 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meUserId
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    mine
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                      : "bg-muted"
                  )}
                >
                  {m.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 flex gap-2">
        <Input
          placeholder={`Message ${otherName}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
