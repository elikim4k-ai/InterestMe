import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getAIProvider, EMBEDDING_DIMENSIONS } from "./provider"
import { cosineSimilarity } from "./scoring"

describe("NullProvider (no API key)", () => {
  const original = process.env.OPENAI_API_KEY

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    // Reset the module singleton by re-importing fresh
  })
  afterEach(() => {
    if (original) process.env.OPENAI_API_KEY = original
  })

  it("falls back to the deterministic provider", () => {
    const provider = getAIProvider()
    expect(provider.isLive).toBe(false)
  })

  it("produces embeddings of the expected dimension", async () => {
    const vec = await getAIProvider().embed("hello world")
    expect(vec).toHaveLength(EMBEDDING_DIMENSIONS)
  })

  it("is deterministic: same text → same vector", async () => {
    const p = getAIProvider()
    const a = await p.embed("machine learning")
    const b = await p.embed("machine learning")
    expect(a).toEqual(b)
  })

  it("produces L2-normalized vectors", async () => {
    const vec = await getAIProvider().embed("startups and design")
    const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    expect(magnitude).toBeCloseTo(1, 5)
  })

  it("gives more similar text higher cosine similarity", async () => {
    const p = getAIProvider()
    const base = await p.embed("artificial intelligence machine learning")
    const near = await p.embed("machine learning artificial intelligence models")
    const far = await p.embed("cooking pasta italian recipes")
    expect(cosineSimilarity(base, near)).toBeGreaterThan(cosineSimilarity(base, far))
  })

  it("returns empty string from complete() so callers use their fallback", async () => {
    const out = await getAIProvider().complete({ prompt: "anything" })
    expect(out).toBe("")
  })

  it("batch embed matches single embed", async () => {
    const p = getAIProvider()
    const [batched] = await p.embedMany(["solo"])
    const single = await p.embed("solo")
    expect(batched).toEqual(single)
  })
})
