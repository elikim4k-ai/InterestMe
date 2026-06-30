"use server"

import { revalidatePath } from "next/cache"
import { createEventSchema, submitAnswersSchema } from "@/lib/validations/event"
import { slugify } from "@/lib/utils"
import { getAuthedUser, getAuthedContext, ok, fail, type ActionResult } from "./helpers"

/** Generates a unique slug for an event by appending a short random suffix. */
function eventSlug(name: string): string {
  const base = slugify(name).slice(0, 40) || "event"
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

/** Create an event with its custom questions. Returns the new event id + slug. */
export async function createEvent(
  input: unknown
): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = createEventSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")

  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  const v = parsed.data
  const slug = eventSlug(v.name)

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      organizer_id: userId,
      name: v.name,
      slug,
      description: v.description || null,
      location: v.location || null,
      start_time: new Date(v.startTime).toISOString(),
      end_time: v.endTime ? new Date(v.endTime).toISOString() : null,
      is_public: v.isPublic,
      max_attendees: v.maxAttendees ?? null,
      rotation_enabled: v.rotationEnabled,
      rotation_minutes: v.rotationEnabled ? v.rotationMinutes ?? 15 : null,
      status: "PUBLISHED",
    })
    .select("id, slug")
    .single()

  if (error) return fail(error.message)

  // Insert questions with order preserved
  if (v.questions.length > 0) {
    const rows = v.questions.map((q, i) => ({
      event_id: event.id,
      text: q.text,
      type: q.type,
      options: q.options ?? null,
      is_required: q.isRequired,
      placeholder: q.placeholder || null,
      order: i,
    }))
    const { error: qError } = await supabase.from("event_questions").insert(rows)
    if (qError) return fail(qError.message)
  }

  revalidatePath("/events")
  return ok({ id: event.id, slug: event.slug })
}

/** Register the current user as an attendee of an event (idempotent). */
export async function joinEvent(eventId: string): Promise<ActionResult<{ attendeeId: string }>> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx

  // Capacity check
  const { data: event } = await supabase
    .from("events")
    .select("max_attendees, status")
    .eq("id", eventId)
    .single()

  if (!event) return fail("Event not found")
  if (event.status === "CANCELLED") return fail("This event has been cancelled")

  if (event.max_attendees) {
    const { count } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
    if (count !== null && count >= event.max_attendees) {
      // Allow if already registered, otherwise reject
      const { data: existing } = await supabase
        .from("event_attendees")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle()
      if (!existing) return fail("This event is at full capacity")
    }
  }

  const { data, error } = await supabase
    .from("event_attendees")
    .upsert(
      { event_id: eventId, user_id: userId, status: "REGISTERED" },
      { onConflict: "event_id,user_id", ignoreDuplicates: false }
    )
    .select("id")
    .single()

  if (error) return fail(error.message)

  await syncAchievementsSafely()

  revalidatePath(`/events/${eventId}`)
  return ok({ attendeeId: data.id })
}

/** Mark the current user as checked in to an event. */
export async function checkInToEvent(eventId: string): Promise<ActionResult> {
  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)

  const { error } = await ctx.supabase
    .from("event_attendees")
    .update({ status: "CHECKED_IN", checked_in_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", ctx.userId)

  if (error) return fail(error.message)

  await syncAchievementsSafely()

  revalidatePath(`/events/${eventId}`)
  return ok(undefined)
}

/** Fire-and-forget achievement sync that never throws into the caller. */
async function syncAchievementsSafely(
  overrides: Parameters<
    typeof import("./gamification").syncAchievements
  >[0] = {}
): Promise<void> {
  try {
    const { syncAchievements } = await import("./gamification")
    await syncAchievements(overrides)
  } catch {
    /* non-fatal */
  }
}

/** Submit (upsert) answers to an event's questions for the current attendee. */
export async function submitAnswers(input: unknown): Promise<ActionResult> {
  const parsed = submitAnswersSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")

  const ctx = await getAuthedUser()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, userId } = ctx
  const { eventId, answers } = parsed.data

  // Resolve attendee row
  const { data: attendee } = await supabase
    .from("event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single()

  if (!attendee) return fail("You must join the event before answering")

  const rows = answers
    .filter((a) => a.answer.trim().length > 0)
    .map((a) => ({
      attendee_id: attendee.id,
      question_id: a.questionId,
      answer: a.answer.trim(),
    }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from("event_answers")
      .upsert(rows, { onConflict: "attendee_id,question_id" })
    if (error) return fail(error.message)
  }

  // Answers materially change a person's match profile → refresh embedding.
  // Best-effort: never block answer submission on embedding success.
  try {
    const { refreshMyEmbedding } = await import("./recommendations")
    await refreshMyEmbedding()
  } catch {
    /* non-fatal */
  }

  revalidatePath(`/event`)
  return ok(undefined)
}

/** Cancel/delete an event — organizer only (RLS also enforces). */
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)

  const { error } = await ctx.supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("organizer_id", ctx.userId)

  if (error) return fail(error.message)

  revalidatePath("/events")
  return ok(undefined)
}
