"use server"

import { getAuthedUser, ok, fail, type ActionResult } from "./helpers"

export interface ChatMessage {
  id: string
  senderId: string
  content: string
  createdAt: string
}

/** Full 1:1 history with another user, oldest first. */
export async function getMessages(otherUserId: string): Promise<ActionResult<ChatMessage[]>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: true })
    .limit(500)

  if (error) return fail(error.message)

  // Mark received messages as read (best-effort).
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("sender_id", otherUserId)
    .eq("receiver_id", userId)
    .eq("read", false)

  return ok(
    (data ?? []).map((m: { id: string; sender_id: string; content: string; created_at: string }) => ({
      id: m.id,
      senderId: m.sender_id,
      content: m.content,
      createdAt: m.created_at,
    }))
  )
}

/** Send a message to another user. */
export async function sendMessage(
  receiverId: string,
  content: string
): Promise<ActionResult<ChatMessage>> {
  const text = content.trim()
  if (!text) return fail("Message is empty")
  if (text.length > 2000) return fail("Message is too long")

  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: userId, receiver_id: receiverId, content: text })
    .select("id, sender_id, content, created_at")
    .single()

  if (error) return fail(error.message)

  // Notify the recipient.
  await supabase.from("notifications").insert({
    user_id: receiverId,
    type: "MESSAGE",
    title: "New message",
    body: text.slice(0, 120),
    metadata: { from: userId },
  })

  return ok({
    id: data.id,
    senderId: data.sender_id,
    content: data.content,
    createdAt: data.created_at,
  })
}
