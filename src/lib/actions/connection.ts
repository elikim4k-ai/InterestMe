"use server"

import { revalidatePath } from "next/cache"
import { generateStarters } from "@/lib/ai/starters"
import { getAuthedContext, getAuthedUser, ok, fail, type ActionResult } from "./helpers"

/** Send a connection request, optionally tagged with the event where you met. */
export async function sendConnectionRequest(
  receiverId: string,
  opts: { eventId?: string; note?: string } = {}
): Promise<ActionResult> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  if (receiverId === userId) return fail("You can't connect with yourself")

  // If they already sent ME a request, accept it instead of creating a dup
  const { data: reverse } = await supabase
    .from("connections")
    .select("id, status")
    .eq("sender_id", receiverId)
    .eq("receiver_id", userId)
    .maybeSingle()

  if (reverse) {
    const { error } = await supabase
      .from("connections")
      .update({ status: "ACCEPTED" })
      .eq("id", reverse.id)
    if (error) return fail(error.message)
  } else {
    const { error } = await supabase.from("connections").upsert(
      {
        sender_id: userId,
        receiver_id: receiverId,
        status: "PENDING",
        met_at_event_id: opts.eventId ?? null,
        note: opts.note ?? null,
      },
      { onConflict: "sender_id,receiver_id", ignoreDuplicates: true }
    )
    if (error) return fail(error.message)

    // Notify the receiver
    await supabase.from("notifications").insert({
      user_id: receiverId,
      type: "CONNECTION_REQUEST",
      title: "New connection request",
      body: "Someone wants to connect with you",
      metadata: { from: userId },
    })
  }

  revalidatePath("/connections")
  revalidatePath("/discover")
  return ok(undefined)
}

export async function respondToConnection(
  connectionId: string,
  accept: boolean
): Promise<ActionResult> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)

  const { error } = await ctx.supabase
    .from("connections")
    .update({ status: accept ? "ACCEPTED" : "DECLINED" })
    .eq("id", connectionId)
    .eq("receiver_id", ctx.userId)

  if (error) return fail(error.message)
  revalidatePath("/connections")
  return ok(undefined)
}

/**
 * Generate (and cache) conversation starters for meeting a specific person at
 * an event. Cached on the recommendation row to avoid repeat LLM calls.
 */
export async function getConversationStarters(
  eventId: string,
  otherUserId: string
): Promise<ActionResult<string[]>> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  // Return cached if present
  const { data: rec } = await supabase
    .from("recommendations")
    .select("conversation_starters, shared_interests")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("recommended_user_id", otherUserId)
    .maybeSingle()

  if (rec?.conversation_starters && Array.isArray(rec.conversation_starters)) {
    return ok(rec.conversation_starters as string[])
  }

  // Load both profiles for context
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .single()

  const { data: them } = await supabase
    .from("profiles")
    .select("display_name, headline, goals(text), projects(title)")
    .eq("user_id", otherUserId)
    .single()

  const starters = await generateStarters({
    myName: me?.display_name ?? "you",
    theirName: them?.display_name ?? "them",
    theirHeadline: them?.headline ?? null,
    sharedInterests: (rec?.shared_interests as string[]) ?? [],
    theirGoals: ((them?.goals ?? []) as Array<{ text: string }>).map((g) => g.text),
    theirProjects: ((them?.projects ?? []) as Array<{ title: string }>).map((p) => p.title),
  })

  // Cache on the rec row (best-effort)
  await supabase
    .from("recommendations")
    .update({ conversation_starters: starters })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("recommended_user_id", otherUserId)

  return ok(starters)
}
