/**
 * AI insights over a user's knowledge graph (lightweight RAG).
 *
 * The graph IS the retrieval context — we serialize it into a compact prompt and
 * let the provider reason over it. Same provider abstraction as matching, so this
 * upgrades to full vector-RAG / agents without changing callers.
 */

import { getAIProvider } from "./provider"
import type { KnowledgeGraph, GraphNodeKind } from "@/lib/knowledge/types"

export interface GraphInsights {
  summary: string
  suggestions: string[]
  /** Whether these came from a live model or the deterministic fallback. */
  live: boolean
}

const INSIGHTS_SYSTEM = `You are a perceptive personal growth and networking coach.
You are given a person's knowledge graph (their interests, projects, goals, events,
and connections). Produce:
- "summary": 2 sentences capturing who this person is and where they're heading.
- "suggestions": 3 concrete, specific next steps (people to meet, things to learn,
  connections to make) grounded ONLY in the graph data.
Return JSON: { "summary": "...", "suggestions": ["...", "...", "..."] }`

function serializeGraph(graph: KnowledgeGraph): {
  text: string
  byKind: Record<GraphNodeKind, string[]>
} {
  const byKind = {} as Record<GraphNodeKind, string[]>
  for (const node of graph.nodes) {
    if (node.kind === "root" || node.kind === "category") continue
    ;(byKind[node.kind] ??= []).push(node.label)
  }
  const lines = Object.entries(byKind).map(
    ([kind, labels]) => `${kind}: ${labels.join(", ")}`
  )
  return { text: lines.join("\n"), byKind }
}

export async function generateGraphInsights(
  graph: KnowledgeGraph
): Promise<GraphInsights> {
  const provider = getAIProvider()
  const { text, byKind } = serializeGraph(graph)

  if (provider.isLive && text.length > 0) {
    try {
      const raw = await provider.complete({
        system: INSIGHTS_SYSTEM,
        json: true,
        temperature: 0.7,
        prompt: `Knowledge graph:\n${text}`,
      })
      const parsed = JSON.parse(raw) as { summary?: string; suggestions?: unknown }
      if (parsed.summary && Array.isArray(parsed.suggestions)) {
        return {
          summary: parsed.summary,
          suggestions: parsed.suggestions
            .filter((s): s is string => typeof s === "string")
            .slice(0, 3),
          live: true,
        }
      }
    } catch {
      // fall through
    }
  }

  return deterministicInsights(byKind)
}

/** Template insights when no live model — still grounded in real graph data. */
function deterministicInsights(
  byKind: Record<GraphNodeKind, string[]>
): GraphInsights {
  const interests = byKind.interest ?? []
  const projects = byKind.project ?? []
  const goals = byKind.goal ?? []
  const people = byKind.person ?? []

  const summaryParts: string[] = []
  if (interests.length) {
    summaryParts.push(`You're driven by ${interests.slice(0, 3).join(", ")}`)
  }
  if (projects.length) {
    summaryParts.push(`and currently building ${projects.slice(0, 2).join(" and ")}`)
  }
  const summary =
    (summaryParts.join(" ") || "Your graph is just getting started.") +
    (goals.length ? ` Your focus: ${goals[0]}.` : "")

  const suggestions: string[] = []
  if (interests.length >= 2) {
    suggestions.push(
      `Meet someone who shares your interest in ${interests[0]} but works in a different field — cross-pollination sparks the best ideas.`
    )
  }
  if (projects.length > 0) {
    suggestions.push(
      `Find a collaborator or advisor for ${projects[0]} at your next event.`
    )
  }
  if (goals.length > 0) {
    suggestions.push(`Seek out people who've already achieved: "${goals[0]}".`)
  }
  if (people.length === 0) {
    suggestions.push("Attend an event and make your first connection to grow your graph.")
  }
  while (suggestions.length < 3) {
    suggestions.push("Add more to your profile so we can surface sharper insights.")
  }

  return { summary, suggestions: suggestions.slice(0, 3), live: false }
}
