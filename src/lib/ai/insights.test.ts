import { describe, it, expect, beforeAll } from "vitest"
import { generateGraphInsights } from "./insights"
import { buildKnowledgeGraph } from "@/lib/knowledge/builder"

beforeAll(() => {
  delete process.env.OPENAI_API_KEY // force deterministic path
})

describe("generateGraphInsights (deterministic fallback)", () => {
  it("marks results as not-live without an API key", async () => {
    const graph = buildKnowledgeGraph({
      displayName: "Ada",
      headline: null,
      interests: [{ name: "AI" }, { name: "Design" }],
      projects: [{ title: "Analytical Engine" }],
      goals: [{ text: "advance computing" }],
      events: [],
      connections: [],
    })
    const insights = await generateGraphInsights(graph)
    expect(insights.live).toBe(false)
    expect(insights.summary.length).toBeGreaterThan(0)
    expect(insights.suggestions).toHaveLength(3)
  })

  it("grounds the summary in real interests", async () => {
    const graph = buildKnowledgeGraph({
      displayName: "Ada",
      headline: null,
      interests: [{ name: "Robotics" }],
      projects: [],
      goals: [],
      events: [],
      connections: [],
    })
    const insights = await generateGraphInsights(graph)
    expect(insights.summary.toLowerCase()).toContain("robotics")
  })

  it("always returns exactly 3 suggestions even for a sparse graph", async () => {
    const graph = buildKnowledgeGraph({
      displayName: "New User",
      headline: null,
      interests: [],
      projects: [],
      goals: [],
      events: [],
      connections: [],
    })
    const insights = await generateGraphInsights(graph)
    expect(insights.suggestions).toHaveLength(3)
  })
})
