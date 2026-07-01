/**
 * Builds the live social graph for an event: attendees as nodes, shared
 * interests (and AI matches) as edges. Pure — easy to test and reuse.
 *
 * Two scopes:
 *  - "mine": you at the center, connected to the people you match with.
 *  - "room": everyone at the event, with an edge between any pair who share an
 *    interest. Your AI matches are highlighted.
 */

import type { KnowledgeGraph, GraphNode, GraphLink } from "./types"

export interface EventAttendee {
  userId: string
  name: string
  interests: string[]
}

export interface EventGraphInput {
  meUserId: string
  meName: string
  meInterests: string[]
  attendees: EventAttendee[] // excludes me
  /** userId → shared interests, for people the AI matched me with. */
  matches: Map<string, string[]>
  scope: "mine" | "room"
}

const ME_ID = "me"

function sharedInterests(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((s) => s.toLowerCase()))
  return a.filter((x) => setB.has(x.toLowerCase()))
}

export function buildEventGraph(input: EventGraphInput): KnowledgeGraph {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  nodes.push({
    id: ME_ID,
    label: input.meName || "You",
    kind: "root",
    val: 1,
    description: "You",
  })

  const matchedIds = new Set(input.matches.keys())

  if (input.scope === "mine") {
    // You → each matched person.
    for (const [userId, shared] of input.matches.entries()) {
      const person = input.attendees.find((a) => a.userId === userId)
      if (!person) continue
      nodes.push(personNode(person, true))
      links.push({
        source: ME_ID,
        target: userId,
        relationship: shared.length ? `shares ${shared.slice(0, 3).join(", ")}` : "matched",
      })
    }
    return { nodes, links }
  }

  // scope === "room": every attendee is a node.
  for (const a of input.attendees) {
    nodes.push(personNode(a, matchedIds.has(a.userId)))
  }

  // Edge from me to anyone I share an interest with.
  for (const a of input.attendees) {
    const shared = sharedInterests(input.meInterests, a.interests)
    if (shared.length > 0 || matchedIds.has(a.userId)) {
      const matchShared = input.matches.get(a.userId)
      const label = (matchShared && matchShared.length ? matchShared : shared).slice(0, 3)
      links.push({
        source: ME_ID,
        target: a.userId,
        relationship: label.length ? `shares ${label.join(", ")}` : "at this event",
      })
    }
  }

  // Edges between other attendees who share an interest (dedup by pair).
  const seen = new Set<string>()
  for (let i = 0; i < input.attendees.length; i++) {
    for (let j = i + 1; j < input.attendees.length; j++) {
      const a = input.attendees[i]!
      const b = input.attendees[j]!
      const shared = sharedInterests(a.interests, b.interests)
      if (shared.length === 0) continue
      const key = [a.userId, b.userId].sort().join("|")
      if (seen.has(key)) continue
      seen.add(key)
      links.push({
        source: a.userId,
        target: b.userId,
        relationship: `shares ${shared.slice(0, 2).join(", ")}`,
      })
    }
  }

  return { nodes, links }
}

function personNode(a: EventAttendee, isMatch: boolean): GraphNode {
  return {
    id: a.userId,
    label: a.name,
    kind: isMatch ? "match" : "person",
    val: isMatch ? 0.5 : 0.35,
    description: a.interests.length ? `Interested in ${a.interests.slice(0, 5).join(", ")}` : undefined,
  }
}
