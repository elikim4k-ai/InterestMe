/**
 * Profile → embedding pipeline. Turns a person's structured data into a single
 * text representation, embeds it, and persists the vector to pgvector.
 */

import { getAIProvider } from "./provider"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface ProfileForEmbedding {
  displayName: string
  headline: string | null
  bio: string | null
  interests: string[]
  goals: string[]
  projects: string[]
  eventAnswers: string[]
}

/** Build the canonical text blob we embed. Order matters less than coverage. */
export function buildProfileText(p: ProfileForEmbedding): string {
  const parts: string[] = []
  if (p.headline) parts.push(`Headline: ${p.headline}`)
  if (p.bio) parts.push(`Bio: ${p.bio}`)
  if (p.interests.length) parts.push(`Interests: ${p.interests.join(", ")}`)
  if (p.goals.length) parts.push(`Goals: ${p.goals.join("; ")}`)
  if (p.projects.length) parts.push(`Building: ${p.projects.join("; ")}`)
  if (p.eventAnswers.length) parts.push(`Says: ${p.eventAnswers.join(" | ")}`)
  return parts.join("\n") || p.displayName
}

/**
 * Computes and stores the embedding for a profile. Uses the service-role
 * Supabase client (passed in) because the pgvector column is written outside
 * the normal RLS-scoped flow (background job style).
 *
 * Returns the vector so callers can use it immediately without re-reading.
 */
export async function embedAndStoreProfile(
  supabase: SupabaseClient,
  profileId: string,
  data: ProfileForEmbedding
): Promise<number[]> {
  const provider = getAIProvider()
  const text = buildProfileText(data)
  const vector = await provider.embed(text)

  // pgvector accepts the array as a string literal "[0.1,0.2,...]"
  const { error } = await supabase
    .from("profiles")
    .update({
      embedding_vector: `[${vector.join(",")}]`,
      embedding_updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)

  if (error) {
    // Non-fatal: matching degrades to non-semantic signals.
    console.error("Failed to store profile embedding:", error.message)
  }

  return vector
}

/** Parse a pgvector value (string or array) back into number[]. */
export function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[]
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as number[]
    } catch {
      return null
    }
  }
  return null
}
