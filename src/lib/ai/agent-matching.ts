/**
 * Agent-based matching via the AI provider's chat completion (OpenAI).
 *
 * Rather than ranking by embedding cosine similarity, we hand the model the full
 * set of attendee profiles and have it *reason* about who should meet whom,
 * returning a ranked list with grounded reasons. This is the "evolve into
 * agent-based recommendations" step the MatchEngine interface was designed for.
 *
 * Runs through the shared getAIProvider() abstraction, so it uses whatever
 * provider is configured (Gemini, OpenAI, …). Falls back to the deterministic
 * EmbeddingMatchEngine when no live provider is available or the call fails, so
 * matching never hard-breaks.
 */

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { MatchEngine, MatchResult } from "./matching"
import { getAIProvider } from "./provider"

const matchOutputSchema = z.object({
  matches: z
    .array(
      z.object({
        id: z.string(),
        score: z.number().min(0).max(1),
        reasons: z.array(z.string()),
        sharedInterests: z.array(z.string()),
      })
    )
    .default([]),
})

const SYSTEM = `You are a socially intelligent networking matchmaker at a live event.
Given one attendee ("me") and a list of candidate attendees, rank the candidates
by how valuable a conversation between them would be. Weigh genuine common ground
(shared interests, complementary goals, related projects) AND productive contrast
(someone worth meeting from a slightly different angle). For each match give 2-3
specific, warm reasons grounded ONLY in the provided data — never invent facts.
Return strongest matches first; omit anyone who would be a weak, generic match.

Respond with ONLY a JSON object of this exact shape:
{"matches":[{"id":"<candidate id>","score":<0..1>,"reasons":["..."],"sharedInterests":["..."]}]}`

interface AttendeeProfile {
  userId: string
  displayName: string
  headline: string | null
  avatarUrl: string | null
  interests: string[]
  goals: string[]
  projects: string[]
  answers: string[]
}

class AgentMatchEngine implements MatchEngine {
  readonly strategy = "agent-llm-v1"

  async computeEventMatches(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    limit = 10
  ): Promise<MatchResult[]> {
    const profiles = await loadAttendeeProfiles(supabase, eventId)
    const me = profiles.find((p) => p.userId === userId)
    const others = profiles.filter((p) => p.userId !== userId)
    if (!me || others.length === 0) return []

    // Map short ids ↔ userIds — cheaper tokens, no need to expose UUIDs.
    const byShortId = new Map<string, AttendeeProfile>()
    const candidates = others.map((p, i) => {
      const id = `c${i}`
      byShortId.set(id, p)
      return {
        id,
        name: p.displayName,
        headline: p.headline,
        interests: p.interests,
        goals: p.goals,
        projects: p.projects,
        answers: p.answers,
      }
    })

    let ranked: z.infer<typeof matchOutputSchema>["matches"]
    try {
      ranked = await rankWithModel(me, candidates)
    } catch (err) {
      console.error("Agent matching failed, falling back to embeddings:", err)
      ranked = []
    }

    // On empty/failed model output, defer to the deterministic engine.
    if (ranked.length === 0) {
      const { getEmbeddingMatchEngine } = await import("./matching")
      return getEmbeddingMatchEngine().computeEventMatches(supabase, userId, eventId, limit)
    }

    return ranked
      .map((m) => {
        const p = byShortId.get(m.id)
        if (!p) return null
        const score = Math.max(0, Math.min(1, m.score))
        return {
          userId: p.userId,
          score: Math.round(score * 1000) / 1000,
          reasons: m.reasons.slice(0, 3),
          signals: {
            semantic: score,
            sharedInterests: m.sharedInterests,
            interestOverlap: 0,
            goalAlignment: 0,
            serendipity: 0,
          },
          displayName: p.displayName,
          headline: p.headline,
          avatarUrl: p.avatarUrl,
        } satisfies MatchResult
      })
      .filter((m): m is MatchResult => m !== null)
      .slice(0, limit)
  }
}

async function rankWithModel(
  me: AttendeeProfile,
  candidates: Array<{ id: string } & Record<string, unknown>>
) {
  const provider = getAIProvider()
  const prompt = JSON.stringify({
    me: {
      name: me.displayName,
      headline: me.headline,
      interests: me.interests,
      goals: me.goals,
      projects: me.projects,
      answers: me.answers,
    },
    candidates,
  })

  const raw = await provider.complete({
    system: SYSTEM,
    prompt,
    json: true,
    temperature: 0.4,
    maxTokens: 1200,
  })
  if (!raw) return []

  const parsed = matchOutputSchema.safeParse(JSON.parse(raw))
  return parsed.success ? parsed.data.matches : []
}

/**
 * Loads every attendee of an event with the rich text the model needs to reason.
 * One round-trip per relation, joined in memory.
 */
async function loadAttendeeProfiles(
  supabase: SupabaseClient,
  eventId: string
): Promise<AttendeeProfile[]> {
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId)

  const userIds = (attendees ?? []).map((a: { user_id: string }) => a.user_id)
  if (userIds.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, headline, avatar_url, profile_interests(interests(name)), goals(text), projects(title)"
    )
    .in("user_id", userIds)

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
    const userId = p.user_id as string
    return {
      userId,
      displayName: (p.display_name as string) ?? "Attendee",
      headline: (p.headline as string | null) ?? null,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      interests: flattenNamed(p.profile_interests, "interests", "name"),
      goals: flattenField(p.goals, "text"),
      projects: flattenField(p.projects, "title"),
      answers: answersByUser.get(userId) ?? [],
    }
  })
}

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

let _engine: AgentMatchEngine | null = null
export function getAgentMatchEngine(): MatchEngine {
  if (!_engine) _engine = new AgentMatchEngine()
  return _engine
}

/** Whether a live AI provider (OpenAI) is configured for reasoning-based matching. */
export function isAgentMatchingAvailable(): boolean {
  return getAIProvider().isLive
}
