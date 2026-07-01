import { describe, it, expect } from "vitest"
import {
  evaluateAchievements,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  type UserStats,
} from "./achievements"

function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    profileComplete: false,
    eventsJoined: 0,
    eventsCheckedIn: 0,
    connections: 0,
    hostedEvents: 0,
    answeredAllAtAnyEvent: false,
    connectedOutsideIndustry: false,
    viewedTopMatches: false,
    ...overrides,
  }
}

describe("achievement catalog", () => {
  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("maps every catalog entry into ACHIEVEMENT_MAP", () => {
    expect(Object.keys(ACHIEVEMENT_MAP).length).toBe(ACHIEVEMENTS.length)
  })

  it("gives every achievement positive XP", () => {
    for (const a of ACHIEVEMENTS) expect(a.xpValue).toBeGreaterThan(0)
  })
})

describe("evaluateAchievements", () => {
  it("earns nothing for a blank slate", () => {
    expect(evaluateAchievements(stats())).toEqual([])
  })

  it("earns first_steps when the profile is complete", () => {
    expect(evaluateAchievements(stats({ profileComplete: true }))).toContain("first_steps")
  })

  it("earns event + check-in badges together", () => {
    const earned = evaluateAchievements(stats({ eventsJoined: 1, eventsCheckedIn: 1 }))
    expect(earned).toContain("event_explorer")
    expect(earned).toContain("checked_in")
  })

  it("gates social_butterfly behind 10 connections", () => {
    expect(evaluateAchievements(stats({ connections: 9 }))).not.toContain("social_butterfly")
    expect(evaluateAchievements(stats({ connections: 10 }))).toContain("social_butterfly")
  })

  it("still earns first_connection at the 10-connection threshold", () => {
    const earned = evaluateAchievements(stats({ connections: 10 }))
    expect(earned).toContain("first_connection")
    expect(earned).toContain("social_butterfly")
  })

  it("earns the hidden cross_pollinator only when flagged", () => {
    expect(evaluateAchievements(stats())).not.toContain("cross_pollinator")
    expect(evaluateAchievements(stats({ connectedOutsideIndustry: true }))).toContain(
      "cross_pollinator"
    )
  })

  it("only returns keys that exist in the catalog", () => {
    const earned = evaluateAchievements(
      stats({
        profileComplete: true,
        eventsJoined: 3,
        eventsCheckedIn: 2,
        connections: 12,
        hostedEvents: 1,
        answeredAllAtAnyEvent: true,
        connectedOutsideIndustry: true,
        viewedTopMatches: true,
      })
    )
    for (const key of earned) expect(ACHIEVEMENT_MAP[key]).toBeDefined()
  })
})
