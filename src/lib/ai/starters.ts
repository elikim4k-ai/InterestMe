/**
 * Conversation starter generation. Uses the LLM when available, with a
 * deterministic template fallback so the feature always produces something useful.
 */

import { getAIProvider } from "./provider"

export interface StarterContext {
  myName: string
  theirName: string
  theirHeadline: string | null
  sharedInterests: string[]
  theirGoals: string[]
  theirProjects: string[]
}

const STARTER_SYSTEM = `You are a warm, socially intelligent networking assistant.
Given two people about to meet at an event, write 3 short, specific opening lines
the first person could use. Rules:
- Reference concrete shared interests or what the other person is building.
- Sound natural and curious, never salesy or generic.
- Each line under 20 words.
Return JSON: { "starters": ["...", "...", "..."] }`

export async function generateStarters(ctx: StarterContext): Promise<string[]> {
  const provider = getAIProvider()

  if (provider.isLive) {
    try {
      const raw = await provider.complete({
        system: STARTER_SYSTEM,
        json: true,
        temperature: 0.8,
        prompt: JSON.stringify({
          meeting: `${ctx.myName} is about to meet ${ctx.theirName}`,
          theirHeadline: ctx.theirHeadline,
          sharedInterests: ctx.sharedInterests,
          theirGoals: ctx.theirGoals,
          theirProjects: ctx.theirProjects,
        }),
      })
      const parsed = JSON.parse(raw) as { starters?: unknown }
      if (Array.isArray(parsed.starters)) {
        const cleaned = parsed.starters
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 3)
        if (cleaned.length > 0) return cleaned
      }
    } catch {
      // fall through to templates
    }
  }

  return templateStarters(ctx)
}

function templateStarters(ctx: StarterContext): string[] {
  const out: string[] = []

  if (ctx.sharedInterests.length > 0) {
    out.push(
      `I saw we're both into ${ctx.sharedInterests[0]} — what got you started with that?`
    )
  }
  if (ctx.theirProjects.length > 0) {
    out.push(`I'd love to hear more about ${ctx.theirProjects[0]} — how's it going?`)
  }
  if (ctx.theirGoals.length > 0) {
    out.push(`You mentioned wanting to ${lowerFirst(ctx.theirGoals[0]!)} — what's the latest there?`)
  }
  if (ctx.theirHeadline) {
    out.push(`"${ctx.theirHeadline}" — that's a great line, tell me the story behind it.`)
  }

  if (out.length === 0) {
    out.push(
      `Hi ${ctx.theirName}! What's been the highlight of the event for you so far?`,
      "What are you most excited about right now?",
      "Who are you hoping to meet here today?"
    )
  }
  return out.slice(0, 3)
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
