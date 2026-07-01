/**
 * Agent-based matching (Claude / Anthropic Messages API).
 *
 * Anthropic has no embeddings API — Claude is a reasoning model. So instead of
 * cosine-similarity ranking, we hand Claude the full set of attendee profiles
 * and have it *reason* about who should meet whom, returning a ranked list with
 * grounded reasons. This is the "evolve into agent-based recommendations" step
 * the MatchEngine interface was designed for in Phase 3.
 *
 * Falls back to the deterministic EmbeddingMatchEngine when no ANTHROPIC_API_KEY
 * is configured or if the model call fails, so matching never hard-breaks.
 */

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { MatchEngine, MatchResult } from "./matching"

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8"

const matchOutputSchema = z.object({
  matches: z
    .array(
      z.object({
        id: z.string().describe("The candidate id you were given, e.g. 'c0'"),
        score: z.number().min(0).max(1).describe("Match strength, 0 to 1"),
        reasons: z
          .array(z.string())
          .describe("2-3 short, specific reasons they should meet"),
        sharedInterests: z
          .array(z.string())
          .describe("Interests/topics they genuinely have in common"),
      })
    )
    .describe("Best matches, strongest first"),
})

const SYSTEM = `You are a socially intelligent networking matchmaker at a live event.
Given one attendee ("me") and a list of candidate attendees, rank the candidates
by how valuable a conversation between them would be. Weigh genuine common ground
(shared interests, complementary goals, related projects) AND productive contrast
(someone worth meeting from a slightly different angle). For each match give 2-3
specific, warm reasons grounded ONLY in the provided data — never invent facts.
Return strongest matches first. Omit anyone who would be a weak, generic match.`

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
  readonly strategy = "agent-claude-v1"

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
      ranked = await rankWithClaude(me, candidates)
    } catch (err) {
      console.error("Agent matching failed, falling back to embeddings:", err)
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

// Raw JSON schema sent to the API (structured outputs). Kept separate from the
// Zod schema, which we use only to validate the response on our side — avoids
// coupling to the SDK's Zod-version-specific helper.
const OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          score: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
          sharedInterests: { type: "array", items: { type: "string" } },
        },
        required: ["id", "score", "reasons", "sharedInterests"],
      },
    },
  },
  required: ["matches"],
} as const

async function rankWithClaude(
  me: AttendeeProfile,
  candidates: Array<{ id: string } & Record<string, unknown>>
) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA } },
  })

  const text = res.content.find((b) => b.type === "text")
  const raw = text && "text" in text ? text.text : ""
  if (!raw) return []

  const parsed = matchOutputSchema.safeParse(JSON.parse(raw))
  return parsed.success ? parsed.data.matches : []
}

/**
 * Loads every attendee of an event with the rich text Claude needs to reason.
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

/** Whether a live Anthropic key is configured. */
export function isAgentMatchingAvailable(): boolean {
  const key = process.env.ANTHROPIC_API_KEY
  return Boolean(key && key.startsWith("sk-ant-"))
}
