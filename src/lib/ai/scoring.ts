/**
 * Pure, deterministic match scoring. No I/O, no AI calls — fully unit-testable.
 *
 * The final match score blends several signals so we never rely on raw embedding
 * similarity alone (which over-rewards people who simply describe themselves
 * similarly). Weights are tuned for "interesting + relevant" introductions.
 */

export interface ScoringProfile {
  userId: string
  interests: string[]
  goals: string[]
  projects: string[]
  /** Concatenated event answers, for semantic comparison. */
  embedding: number[] | null
}

export interface MatchSignals {
  semantic: number // 0..1 cosine similarity of embeddings
  sharedInterests: string[]
  interestOverlap: number // 0..1 Jaccard
  goalAlignment: number // 0..1
  serendipity: number // 0..1 — rewards SOME difference (cross-pollination)
}

export interface ScoredMatch {
  userId: string
  score: number // 0..1 final blended score
  signals: MatchSignals
  reasons: string[]
}

// Signal weights — must sum to 1.0
const WEIGHTS = {
  semantic: 0.4,
  interestOverlap: 0.3,
  goalAlignment: 0.2,
  serendipity: 0.1,
} as const

export function cosineSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    magA += av * av
    magB += bv * bv
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0
  // Clamp to [0,1] — embeddings are normalized so cosine ∈ [-1,1]
  return Math.max(0, Math.min(1, dot / denom))
}

function jaccard(a: string[], b: string[]): { overlap: number; shared: string[] } {
  const setA = new Set(a.map((s) => s.toLowerCase().trim()))
  const setB = new Set(b.map((s) => s.toLowerCase().trim()))
  if (setA.size === 0 && setB.size === 0) return { overlap: 0, shared: [] }
  const shared = [...setA].filter((x) => setB.has(x))
  const union = new Set([...setA, ...setB])
  return { overlap: union.size === 0 ? 0 : shared.length / union.size, shared }
}

/**
 * Goal alignment uses semantic-ish keyword overlap. With a live provider this
 * could be upgraded to embedding comparison per-goal; the interface stays same.
 */
function goalAlignment(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const wordsA = new Set(a.join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(b.join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const shared = [...wordsA].filter((w) => wordsB.has(w)).length
  return Math.min(1, shared / Math.min(wordsA.size, wordsB.size))
}

/**
 * Serendipity rewards pairs who share *some* context but differ enough to be
 * worth meeting. Peaks when interest overlap is moderate (~0.3).
 */
function serendipity(interestOverlap: number): number {
  // Inverted-U centered at 0.3
  const peak = 0.3
  return Math.max(0, 1 - Math.abs(interestOverlap - peak) / 0.7)
}

export function scoreMatch(me: ScoringProfile, other: ScoringProfile): ScoredMatch {
  const semantic = cosineSimilarity(me.embedding, other.embedding)
  const { overlap: interestOverlap, shared: sharedInterests } = jaccard(
    me.interests,
    other.interests
  )
  const goal = goalAlignment(me.goals, other.goals)
  const serend = serendipity(interestOverlap)

  const score =
    WEIGHTS.semantic * semantic +
    WEIGHTS.interestOverlap * interestOverlap +
    WEIGHTS.goalAlignment * goal +
    WEIGHTS.serendipity * serend

  const signals: MatchSignals = {
    semantic,
    sharedInterests,
    interestOverlap,
    goalAlignment: goal,
    serendipity: serend,
  }

  return {
    userId: other.userId,
    score: Math.round(score * 1000) / 1000,
    signals,
    reasons: buildReasons(signals, other),
  }
}

function buildReasons(signals: MatchSignals, other: ScoringProfile): string[] {
  const reasons: string[] = []

  if (signals.sharedInterests.length > 0) {
    const display = signals.sharedInterests.slice(0, 3).join(", ")
    reasons.push(`You both care about ${display}`)
  }
  if (signals.goalAlignment > 0.4) {
    reasons.push("You're working toward similar goals")
  }
  if (signals.semantic > 0.6) {
    reasons.push("Your answers reveal a lot of common ground")
  }
  if (signals.interestOverlap < 0.2 && signals.semantic > 0.4) {
    reasons.push("A fresh perspective from outside your usual circle")
  }
  if (other.projects.length > 0 && reasons.length < 3) {
    reasons.push(`Currently building: ${other.projects[0]}`)
  }
  if (reasons.length === 0) {
    reasons.push("A new person to meet at this event")
  }
  return reasons.slice(0, 3)
}

/** Sort + take top N matches above a minimum score floor. */
export function rankMatches(matches: ScoredMatch[], limit = 10): ScoredMatch[] {
  return matches
    .filter((m) => m.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
