import { describe, it, expect } from "vitest"
import {
  cosineSimilarity,
  scoreMatch,
  rankMatches,
  type ScoringProfile,
  type ScoredMatch,
} from "./scoring"

function profile(overrides: Partial<ScoringProfile> = {}): ScoringProfile {
  return {
    userId: "u",
    interests: [],
    goals: [],
    projects: [],
    embedding: null,
    ...overrides,
  }
}

describe("cosineSimilarity", () => {
  it("returns 0 for null or mismatched vectors", () => {
    expect(cosineSimilarity(null, [1, 2])).toBe(0)
    expect(cosineSimilarity([1, 2], null)).toBe(0)
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it("returns 1 for identical direction vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
  })

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("clamps negative cosine to 0", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0)
  })

  it("handles zero-magnitude vectors", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })
})

describe("scoreMatch", () => {
  it("scores higher for shared interests than none", () => {
    const me = profile({ interests: ["AI", "Startups", "Design"] })
    const similar = profile({ userId: "a", interests: ["AI", "Startups"] })
    const different = profile({ userId: "b", interests: ["Cooking"] })

    const s1 = scoreMatch(me, similar)
    const s2 = scoreMatch(me, different)
    expect(s1.score).toBeGreaterThan(s2.score)
  })

  it("surfaces shared interests in signals", () => {
    const me = profile({ interests: ["AI", "Music"] })
    const other = profile({ userId: "a", interests: ["ai", "Sports"] })
    const result = scoreMatch(me, other)
    // case-insensitive overlap
    expect(result.signals.sharedInterests).toContain("ai")
  })

  it("produces a score within [0,1]", () => {
    const me = profile({ interests: ["AI"], goals: ["ship a product"], embedding: [1, 0] })
    const other = profile({ userId: "a", interests: ["AI"], goals: ["ship a startup"], embedding: [1, 0] })
    const result = scoreMatch(me, other)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it("always returns at least one reason", () => {
    const me = profile()
    const other = profile({ userId: "a" })
    expect(scoreMatch(me, other).reasons.length).toBeGreaterThanOrEqual(1)
  })

  it("rewards goal alignment", () => {
    const me = profile({ goals: ["learn machine learning deeply"] })
    const aligned = profile({ userId: "a", goals: ["learn machine learning fundamentals"] })
    const unaligned = profile({ userId: "b", goals: ["travel around the world"] })
    expect(scoreMatch(me, aligned).signals.goalAlignment).toBeGreaterThan(
      scoreMatch(me, unaligned).signals.goalAlignment
    )
  })

  it("mentions what the other person is building when relevant", () => {
    const me = profile()
    const other = profile({ userId: "a", projects: ["a developer tool"] })
    const reasons = scoreMatch(me, other).reasons.join(" ")
    expect(reasons.toLowerCase()).toContain("developer tool")
  })
})

describe("rankMatches", () => {
  const mk = (userId: string, score: number): ScoredMatch => ({
    userId,
    score,
    signals: {
      semantic: 0,
      sharedInterests: [],
      interestOverlap: 0,
      goalAlignment: 0,
      serendipity: 0,
    },
    reasons: [],
  })

  it("sorts descending by score", () => {
    const ranked = rankMatches([mk("a", 0.3), mk("b", 0.9), mk("c", 0.6)])
    expect(ranked.map((m) => m.userId)).toEqual(["b", "c", "a"])
  })

  it("filters out near-zero scores", () => {
    const ranked = rankMatches([mk("a", 0.01), mk("b", 0.5)])
    expect(ranked.map((m) => m.userId)).toEqual(["b"])
  })

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => mk(`u${i}`, (i + 1) / 20))
    expect(rankMatches(many, 5)).toHaveLength(5)
  })
})
