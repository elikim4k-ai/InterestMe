/**
 * Builds a person's branching knowledge graph from their structured data.
 *
 * Shape (Obsidian-style):  root → category hubs → leaf nodes
 *
 *                    ┌── Interests ── (each interest)
 *      You (root) ───┼── Projects  ── (each project)
 *                    ├── Goals     ── (each goal)
 *                    ├── Events    ── (each event)
 *                    └── People    ── (each connection)
 *
 * Pure given its input → easy to test and reuse server- or client-side.
 */

import type { KnowledgeGraph, GraphNode, GraphLink, GraphNodeKind } from "./types"

export interface GraphSourceData {
  displayName: string
  headline: string | null
  interests: { name: string; category?: string | null }[]
  projects: { title: string; description?: string | null; status?: string | null }[]
  goals: { text: string }[]
  events: { name: string; startTime?: string | null }[]
  connections: { name: string; headline?: string | null }[]
}

interface CategorySpec {
  id: string
  label: string
  kind: GraphNodeKind
}

const CATEGORIES: CategorySpec[] = [
  { id: "cat-interests", label: "Interests", kind: "category" },
  { id: "cat-projects", label: "Projects", kind: "category" },
  { id: "cat-goals", label: "Goals", kind: "category" },
  { id: "cat-events", label: "Events", kind: "category" },
  { id: "cat-people", label: "People", kind: "category" },
]

export function buildKnowledgeGraph(data: GraphSourceData): KnowledgeGraph {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  // Root
  const rootId = "root"
  nodes.push({
    id: rootId,
    label: data.displayName || "You",
    kind: "root",
    val: 1,
    description: data.headline ?? "Your personal knowledge graph",
  })

  // Category hubs — only add a hub if it has children
  const counts = {
    "cat-interests": data.interests.length,
    "cat-projects": data.projects.length,
    "cat-goals": data.goals.length,
    "cat-events": data.events.length,
    "cat-people": data.connections.length,
  } as Record<string, number>

  for (const cat of CATEGORIES) {
    if (counts[cat.id]! === 0) continue
    nodes.push({
      id: cat.id,
      label: cat.label,
      kind: cat.kind,
      val: 0.55,
      description: `${counts[cat.id]} ${cat.label.toLowerCase()}`,
    })
    links.push({ source: rootId, target: cat.id, relationship: "has" })
  }

  // Interests
  data.interests.forEach((interest, i) => {
    const id = `interest-${i}`
    nodes.push({
      id,
      label: interest.name,
      kind: "interest",
      val: 0.35,
      description: interest.category ? `Interest · ${interest.category}` : "Interest",
    })
    links.push({ source: "cat-interests", target: id, relationship: "interested_in" })
  })

  // Projects
  data.projects.forEach((project, i) => {
    const id = `project-${i}`
    nodes.push({
      id,
      label: project.title,
      kind: "project",
      val: 0.4,
      description: project.description ?? "Project",
      meta: { status: project.status ?? "active" },
    })
    links.push({ source: "cat-projects", target: id, relationship: "building" })
  })

  // Goals
  data.goals.forEach((goal, i) => {
    const id = `goal-${i}`
    nodes.push({
      id,
      label: truncate(goal.text, 40),
      kind: "goal",
      val: 0.35,
      description: goal.text,
    })
    links.push({ source: "cat-goals", target: id, relationship: "pursuing" })
  })

  // Events
  data.events.forEach((event, i) => {
    const id = `event-${i}`
    nodes.push({
      id,
      label: event.name,
      kind: "event",
      val: 0.4,
      description: event.startTime
        ? `Attended · ${new Date(event.startTime).toLocaleDateString()}`
        : "Event",
    })
    links.push({ source: "cat-events", target: id, relationship: "attended" })
  })

  // People
  data.connections.forEach((person, i) => {
    const id = `person-${i}`
    nodes.push({
      id,
      label: person.name,
      kind: "person",
      val: 0.35,
      description: person.headline ?? "Connection",
    })
    links.push({ source: "cat-people", target: id, relationship: "knows" })
  })

  return { nodes, links }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
