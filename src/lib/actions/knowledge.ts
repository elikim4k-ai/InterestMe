"use server"

import { buildKnowledgeGraph, type GraphSourceData } from "@/lib/knowledge/builder"
import type { KnowledgeGraph } from "@/lib/knowledge/types"
import { generateGraphInsights, type GraphInsights } from "@/lib/ai/insights"
import { getAIProvider } from "@/lib/ai/provider"
import { getAuthedContext, ok, fail, type ActionResult } from "./helpers"

/**
 * Assembles the current user's living knowledge graph from their profile,
 * interests, projects, goals, events attended, and accepted connections.
 */
export async function getMyKnowledgeGraph(): Promise<ActionResult<KnowledgeGraph>> {
  const ctx = await getAuthedContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, profileId, userId } = ctx

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, headline, profile_interests(interests(name, category)), projects(title, description, status), goals(text)"
    )
    .eq("id", profileId)
    .single()

  // Events the user attended
  const { data: attendances } = await supabase
    .from("event_attendees")
    .select("event:events(name, start_time)")
    .eq("user_id", userId)

  // Accepted connections (either direction) → fetch the *other* person
  const { data: connectionRows } = await supabase
    .from("connections")
    .select("sender_id, receiver_id")
    .eq("status", "ACCEPTED")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

  const otherIds = (connectionRows ?? [])
    .map((c: { sender_id: string; receiver_id: string }) =>
      c.sender_id === userId ? c.receiver_id : c.sender_id
    )
    .filter(Boolean)

  const { data: peopleProfiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("display_name, headline")
        .in("user_id", otherIds)
    : { data: [] }

  const source: GraphSourceData = {
    displayName: profile?.display_name ?? "You",
    headline: profile?.headline ?? null,
    interests: flattenNamed(profile?.profile_interests, "interests").map((x) => ({
      name: x.name as string,
      category: (x.category as string | null) ?? null,
    })),
    projects: ((profile?.projects ?? []) as Array<{
      title: string
      description: string | null
      status: string | null
    }>).map((p) => ({ title: p.title, description: p.description, status: p.status })),
    goals: ((profile?.goals ?? []) as Array<{ text: string }>).map((g) => ({ text: g.text })),
    events: ((attendances ?? []) as Array<{
      event: { name: string; start_time: string } | { name: string; start_time: string }[] | null
    }>)
      .map((a) => (Array.isArray(a.event) ? a.event[0] : a.event))
      .filter((e): e is { name: string; start_time: string } => Boolean(e))
      .map((e) => ({ name: e.name, startTime: e.start_time })),
    connections: ((peopleProfiles ?? []) as Array<{
      display_name: string
      headline: string | null
    }>).map((p) => ({ name: p.display_name, headline: p.headline })),
  }

  return ok(buildKnowledgeGraph(source))
}

/** AI-generated insights (summary + suggestions) over the user's graph. */
export async function getGraphInsights(): Promise<ActionResult<GraphInsights>> {
  const graphResult = await getMyKnowledgeGraph()
  if (!graphResult.success) return graphResult
  const insights = await generateGraphInsights(graphResult.data)
  return ok(insights)
}

/**
 * Ask a free-form question answered against the user's knowledge graph (RAG).
 * The graph is the retrieval context. Falls back to a helpful message when no
 * live model is configured.
 */
export async function askMyGraph(
  question: string
): Promise<ActionResult<{ answer: string; live: boolean }>> {
  const trimmed = question.trim()
  if (trimmed.length < 3) return fail("Please ask a fuller question")
  if (trimmed.length > 500) return fail("Question is too long")

  const graphResult = await getMyKnowledgeGraph()
  if (!graphResult.success) return graphResult

  const provider = getAIProvider()
  const context = graphResult.data.nodes
    .filter((n) => n.kind !== "root" && n.kind !== "category")
    .map((n) => `- ${n.kind}: ${n.label}${n.description ? ` (${n.description})` : ""}`)
    .join("\n")

  if (!provider.isLive) {
    return ok({
      answer:
        "Connect an AI model (set OPENAI_API_KEY) to ask open questions about your graph. " +
        "Meanwhile, your insights panel still surfaces grounded suggestions.",
      live: false,
    })
  }

  try {
    const answer = await provider.complete({
      system:
        "Answer the user's question using ONLY the knowledge graph context provided. " +
        "If the answer isn't in the graph, say so honestly. Be concise and specific.",
      prompt: `Knowledge graph:\n${context}\n\nQuestion: ${trimmed}`,
      temperature: 0.5,
      maxTokens: 300,
    })
    return ok({ answer: answer.trim() || "I couldn't find an answer in your graph.", live: true })
  } catch {
    return fail("Could not reach the AI model. Please try again.")
  }
}

/** Flatten Supabase nested relation arrays into plain objects. */
function flattenNamed(
  rows: unknown,
  relation: string
): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => {
      const rel = (r as Record<string, unknown>)?.[relation]
      return (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined
    })
    .filter((x): x is Record<string, unknown> => Boolean(x))
}
