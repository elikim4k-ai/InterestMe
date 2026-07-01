/**
 * Personal knowledge graph types. Shared between the server builder and the
 * client 3D renderer, so the shape is the contract.
 */

export type GraphNodeKind =
  | "root"
  | "category"
  | "interest"
  | "project"
  | "goal"
  | "skill"
  | "event"
  | "person"
  | "match"

export interface GraphNode {
  id: string
  label: string
  kind: GraphNodeKind
  /** Visual weight (drives node size). 0..1 */
  val: number
  /** Optional detail surfaced in the inspector panel. */
  description?: string
  meta?: Record<string, string | number | null>
}

export interface GraphLink {
  source: string
  target: string
  /** Relationship label, e.g. "interested_in", "building", "attended". */
  relationship: string
  /** 0..1 tie strength (e.g. match score). Higher = drawn closer together. */
  strength?: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

/** Color tokens per node kind — referenced by the 3D renderer. */
export const NODE_COLORS: Record<GraphNodeKind, string> = {
  root: "#a78bfa", // violet-400 (the central "you" node)
  category: "#64748b", // slate-500 (the faint hub labels)
  interest: "#8b5cf6", // violet-500
  project: "#ec4899", // pink-500
  goal: "#f59e0b", // amber-500
  skill: "#10b981", // emerald-500
  event: "#3b82f6", // blue-500
  person: "#06b6d4", // cyan-500
  match: "#ec4899", // pink-500 — an AI-recommended match
}

export const NODE_KIND_LABEL: Record<GraphNodeKind, string> = {
  root: "You",
  category: "Category",
  interest: "Interest",
  project: "Project",
  goal: "Goal",
  skill: "Skill",
  event: "Event",
  person: "Connection",
  match: "AI Match",
}
