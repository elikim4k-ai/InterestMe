/**
 * Match engine orchestrator.
 *
 * `MatchEngine` is the stable contract the rest of the app depends on. Today we
 * ship `EmbeddingMatchEngine` (embeddings + deterministic scoring). When we
 * build agent-based recommendations, `AgentMatchEngine` implements the same
 * interface and nothing else changes.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseEmbedding } from "./embeddings"
import { scoreMatch, rankMatches, type ScoringProfile, type ScoredMatch } from "./scoring"

export interface MatchResult extends ScoredMatch {
  displayName: string
  headline: string | null
  avatarUrl: string | null
}

export interface MatchEngine {
  readonly strategy: string
  /** Compute ranked matches for `userId` among attendees of `eventId`. */
  computeEventMatches(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    limit?: number
  ): Promise<MatchResult[]>
}

// ─── Embedding + scoring engine (Phase 3) ────────────────────────────────────

class EmbeddingMatchEngine implements MatchEngine {
  readonly strategy = "embedding-v1"

  async computeEventMatches(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    limit = 10
  ): Promise<MatchResult[]> {
    const profiles = await loadEventProfiles(supabase, eventId)
    const me = profiles.find((p) => p.userId === userId)
    if (!me) return []

    const others = profiles.filter((p) => p.userId !== userId)
    const scored = others.map((other) => {
      const match = scoreMatch(me.scoring, other.scoring)
      return {
        ...match,
        displayName: other.displayName,
        headline: other.headline,
        avatarUrl: other.avatarUrl,
      }
    })

    return rankMatches(scored, limit) as MatchResult[]
  }
}

interface LoadedProfile {
  userId: string
  displayName: string
  headline: string | null
  avatarUrl: string | null
  scoring: ScoringProfile
}

/**
 * Loads all checked-in/registered attendees of an event with the data needed
 * for scoring. One round-trip per relation, joined in memory.
 */
async function loadEventProfiles(
  supabase: SupabaseClient,
  eventId: string
): Promise<LoadedProfile[]> {
  // Attendee user ids
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId)

  const userIds = (attendees ?? []).map((a: { user_id: string }) => a.user_id)
  if (userIds.length === 0) return []

  // Profiles + nested interests/goals/projects + embedding
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, user_id, display_name, headline, avatar_url, embedding_vector, profile_interests(interests(name)), goals(text), projects(title)"
    )
    .in("user_id", userIds)

  // Event answers grouped by user (shared context signal)
  const { data: answerRows } = await supabase
    .from("event_answers")
    .select("answer, attendee:event_attendees!inner(user_id, event_id)")
    .eq("attendee.event_id", eventId)

  const answersByUser = new Map<string, string[]>()
  for (const row of (answerRows ?? []) as Array<{
    answer: string
    attendee: { user_id: string } | { user_id: string }[]
  }>) {
    const att = Array.isArray(row.attendee) ? row.attendee[0] : row.attendee
    if (!att) continue
    const arr = answersByUser.get(att.user_id) ?? []
    arr.push(row.answer)
    answersByUser.set(att.user_id, arr)
  }

  return (profiles ?? []).map((p: Record<string, unknown>) => {
    const interests = flattenNamed(p.profile_interests, "interests", "name")
    const goals = flattenField(p.goals, "text")
    const projects = flattenField(p.projects, "title")
    const userId = p.user_id as string

    return {
      userId,
      displayName: (p.display_name as string) ?? "Attendee",
      headline: (p.headline as string | null) ?? null,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      scoring: {
        userId,
        interests,
        goals,
        projects,
        embedding: parseEmbedding(p.embedding_vector),
      },
    }
  })
}

// ── Supabase nested-relation flatteners (relations come back as arrays) ──

function flattenField(rows: unknown, field: string): string[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => (r as Record<string, unknown>)?.[field])
    .filter((v): v is string => typeof v === "string")
}

function flattenNamed(rows: unknown, relation: string, field: string): string[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => {
      const rel = (r as Record<string, unknown>)?.[relation]
      const obj = Array.isArray(rel) ? rel[0] : rel
      return (obj as Record<string, unknown>)?.[field]
    })
    .filter((v): v is string => typeof v === "string")
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _engine: MatchEngine | null = null

export function getMatchEngine(): MatchEngine {
  if (!_engine) _engine = new EmbeddingMatchEngine()
  return _engine
}
