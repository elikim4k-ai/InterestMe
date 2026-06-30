"use server"

import { revalidatePath } from "next/cache"
import { profileSchema, projectSchema } from "@/lib/validations/profile"
import { slugify } from "@/lib/utils"
import { getAuthedContext, ok, fail, type ActionResult } from "./helpers"

/** Update core profile fields. */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")

  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)

  const v = parsed.data
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      headline: v.headline || null,
      bio: v.bio || null,
      location: v.location || null,
      website: v.website || null,
      linkedin_url: v.linkedinUrl || null,
      instagram_url: v.instagramUrl || null,
      github_url: v.githubUrl || null,
    })
    .eq("id", ctx.profileId)

  if (error) return fail(error.message)

  revalidatePath("/profile")
  return ok(undefined)
}

/**
 * Replace the user's interests. Upserts interest taxonomy rows, then
 * reconciles the join table to exactly the provided set.
 */
export async function setInterests(labels: string[]): Promise<ActionResult> {
  if (labels.length > 10) return fail("Pick up to 10 interests")

  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, profileId } = ctx

  // Upsert taxonomy and collect ids
  const interestIds: string[] = []
  for (const label of labels) {
    const slug = slugify(label)
    const { data, error } = await supabase
      .from("interests")
      .upsert({ name: label, slug }, { onConflict: "slug" })
      .select("id")
      .single()
    if (error) return fail(error.message)
    if (data) interestIds.push(data.id)
  }

  // Clear existing then insert — simplest correct reconciliation
  await supabase.from("profile_interests").delete().eq("profile_id", profileId)

  if (interestIds.length > 0) {
    const rows = interestIds.map((interest_id) => ({ profile_id: profileId, interest_id }))
    const { error } = await supabase.from("profile_interests").insert(rows)
    if (error) return fail(error.message)
  }

  revalidatePath("/profile")
  return ok(undefined)
}

/** Replace the user's goals with the provided list. */
export async function setGoals(goals: string[]): Promise<ActionResult> {
  const cleaned = goals.map((g) => g.trim()).filter(Boolean).slice(0, 5)

  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, profileId } = ctx

  await supabase.from("goals").delete().eq("profile_id", profileId)

  if (cleaned.length > 0) {
    const rows = cleaned.map((text) => ({ profile_id: profileId, text }))
    const { error } = await supabase.from("goals").insert(rows)
    if (error) return fail(error.message)
  }

  revalidatePath("/profile")
  return ok(undefined)
}

/** Add a project to the user's profile. */
export async function addProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")

  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)

  const v = parsed.data
  const { data, error } = await ctx.supabase
    .from("projects")
    .insert({
      profile_id: ctx.profileId,
      title: v.title,
      description: v.description || null,
      url: v.url || null,
      status: v.status,
    })
    .select("id")
    .single()

  if (error) return fail(error.message)

  revalidatePath("/profile")
  return ok({ id: data.id })
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)

  // RLS enforces ownership; also scope by profile for defense-in-depth
  const { error } = await ctx.supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("profile_id", ctx.profileId)

  if (error) return fail(error.message)

  revalidatePath("/profile")
  return ok(undefined)
}

/**
 * Complete onboarding in one atomic-ish call. Used by the onboarding wizard
 * so all profile setup goes through the same validated path.
 */
export async function completeOnboarding(input: {
  profile: unknown
  interests: string[]
  goals: string[]
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input.profile)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")

  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)

  const v = parsed.data
  const { error: profileError } = await ctx.supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      headline: v.headline || null,
      bio: v.bio || null,
      location: v.location || null,
      onboarding_done: true,
    })
    .eq("id", ctx.profileId)

  if (profileError) return fail(profileError.message)

  const interestResult = await setInterests(input.interests)
  if (!interestResult.success) return interestResult

  const goalResult = await setGoals(input.goals)
  if (!goalResult.success) return goalResult

  // Seed the user's embedding so they get matches at their first event.
  try {
    const { refreshMyEmbedding } = await import("./recommendations")
    await refreshMyEmbedding()
  } catch {
    /* non-fatal */
  }

  revalidatePath("/dashboard")
  return ok(undefined)
}
