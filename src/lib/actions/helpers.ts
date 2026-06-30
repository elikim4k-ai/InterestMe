import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function fail(error: string): ActionResult<never> {
  return { success: false, error }
}

/**
 * Resolves the authenticated user + their profile id.
 * Throws-free: returns a discriminated result so actions can early-return.
 */
export async function getAuthedContext(): Promise<
  | { ok: true; userId: string; profileId: string; supabase: SupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!profile) return { ok: false, error: "Profile not found" }

  return { ok: true, userId: user.id, profileId: profile.id, supabase }
}

/** Lighter variant when only the user (not profile) is needed. */
export async function getAuthedUser(): Promise<
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: "Not authenticated" }
  return { ok: true, userId: user.id, supabase }
}
