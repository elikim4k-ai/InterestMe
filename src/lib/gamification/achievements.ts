/**
 * Achievement catalog + unlock evaluation.
 *
 * Achievements are keyed by a stable string. The catalog is the source of truth;
 * `achievements` table rows are seeded from it (see seed.ts). Unlock checks are
 * pure given a stats snapshot, so they're easy to test and trigger from anywhere.
 */

export interface AchievementDef {
  key: string
  name: string
  description: string
  emoji: string
  xpValue: number
  /** Hidden achievements aren't shown until unlocked. */
  hidden?: boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_steps",
    name: "First Steps",
    description: "Complete your profile",
    emoji: "👣",
    xpValue: 20,
  },
  {
    key: "event_explorer",
    name: "Event Explorer",
    description: "Join your first event",
    emoji: "🗺️",
    xpValue: 25,
  },
  {
    key: "checked_in",
    name: "In The Room",
    description: "Check in to an event",
    emoji: "📍",
    xpValue: 15,
  },
  {
    key: "first_connection",
    name: "Icebreaker",
    description: "Make your first connection",
    emoji: "🤝",
    xpValue: 30,
  },
  {
    key: "social_butterfly",
    name: "Social Butterfly",
    description: "Make 10 connections",
    emoji: "🦋",
    xpValue: 100,
  },
  {
    key: "curious_mind",
    name: "Curious Mind",
    description: "Answer all questions at an event",
    emoji: "🧠",
    xpValue: 25,
  },
  {
    key: "cross_pollinator",
    name: "Cross-Pollinator",
    description: "Connect with someone outside your industry",
    emoji: "🌸",
    xpValue: 50,
    hidden: true,
  },
  {
    key: "host",
    name: "Convener",
    description: "Host your first event",
    emoji: "🎪",
    xpValue: 40,
  },
  {
    key: "top_matches",
    name: "Perfect Match",
    description: "View your top 5 recommended matches",
    emoji: "✨",
    xpValue: 20,
  },
]

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.key, a])
)

/** Snapshot of a user's stats used to evaluate which achievements they've earned. */
export interface UserStats {
  profileComplete: boolean
  eventsJoined: number
  eventsCheckedIn: number
  connections: number
  hostedEvents: number
  answeredAllAtAnyEvent: boolean
  connectedOutsideIndustry: boolean
  viewedTopMatches: boolean
}

/** Returns the keys the user currently qualifies for (regardless of prior unlock). */
export function evaluateAchievements(stats: UserStats): string[] {
  const earned: string[] = []
  if (stats.profileComplete) earned.push("first_steps")
  if (stats.eventsJoined >= 1) earned.push("event_explorer")
  if (stats.eventsCheckedIn >= 1) earned.push("checked_in")
  if (stats.connections >= 1) earned.push("first_connection")
  if (stats.connections >= 10) earned.push("social_butterfly")
  if (stats.answeredAllAtAnyEvent) earned.push("curious_mind")
  if (stats.connectedOutsideIndustry) earned.push("cross_pollinator")
  if (stats.hostedEvents >= 1) earned.push("host")
  if (stats.viewedTopMatches) earned.push("top_matches")
  return earned
}
