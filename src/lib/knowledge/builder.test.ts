import { describe, it, expect } from "vitest"
import { buildKnowledgeGraph, type GraphSourceData } from "./builder"

function source(overrides: Partial<GraphSourceData> = {}): GraphSourceData {
  return {
    displayName: "Ada",
    headline: "Builder",
    interests: [],
    projects: [],
    goals: [],
    events: [],
    connections: [],
    ...overrides,
  }
}

describe("buildKnowledgeGraph", () => {
  it("always includes a single root node", () => {
    const graph = buildKnowledgeGraph(source())
    const roots = graph.nodes.filter((n) => n.kind === "root")
    expect(roots).toHaveLength(1)
    expect(roots[0]!.label).toBe("Ada")
  })

  it("omits category hubs that have no children", () => {
    const graph = buildKnowledgeGraph(source({ interests: [{ name: "AI" }] }))
    const categories = graph.nodes.filter((n) => n.kind === "category")
    expect(categories.map((c) => c.id)).toEqual(["cat-interests"])
  })

  it("links every leaf to its category hub", () => {
    const graph = buildKnowledgeGraph(
      source({ interests: [{ name: "AI" }, { name: "Design" }], goals: [{ text: "ship" }] })
    )
    const interestNodes = graph.nodes.filter((n) => n.kind === "interest")
    expect(interestNodes).toHaveLength(2)
    for (const node of interestNodes) {
      const link = graph.links.find((l) => l.target === node.id)
      expect(link?.source).toBe("cat-interests")
    }
  })

  it("connects the root to each present category", () => {
    const graph = buildKnowledgeGraph(
      source({ interests: [{ name: "AI" }], projects: [{ title: "X" }] })
    )
    const rootLinks = graph.links.filter((l) => l.source === "root")
    expect(rootLinks.map((l) => l.target).sort()).toEqual([
      "cat-interests",
      "cat-projects",
    ])
  })

  it("truncates long goal labels but keeps full text in description", () => {
    const longGoal = "a".repeat(80)
    const graph = buildKnowledgeGraph(source({ goals: [{ text: longGoal }] }))
    const goalNode = graph.nodes.find((n) => n.kind === "goal")!
    expect(goalNode.label.length).toBeLessThanOrEqual(40)
    expect(goalNode.description).toBe(longGoal)
  })

  it("carries project status into node metadata", () => {
    const graph = buildKnowledgeGraph(
      source({ projects: [{ title: "Rocket", status: "active" }] })
    )
    const projectNode = graph.nodes.find((n) => n.kind === "project")!
    expect(projectNode.meta?.status).toBe("active")
  })

  it("produces no dangling links (every endpoint exists)", () => {
    const graph = buildKnowledgeGraph(
      source({
        interests: [{ name: "AI" }],
        projects: [{ title: "X" }],
        goals: [{ text: "learn" }],
        events: [{ name: "Summit" }],
        connections: [{ name: "Grace" }],
      })
    )
    const ids = new Set(graph.nodes.map((n) => n.id))
    for (const link of graph.links) {
      expect(ids.has(link.source)).toBe(true)
      expect(ids.has(link.target)).toBe(true)
    }
  })

  it("falls back to display name when root has no headline", () => {
    const graph = buildKnowledgeGraph(source({ headline: null }))
    expect(graph.nodes[0]!.description).toBeTruthy()
  })
})
