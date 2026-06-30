// Auto-generated from Prisma schema — extend as needed

export type UserRole = "USER" | "ORGANIZER" | "ADMIN"
export type EventStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
export type AttendeeStatus = "REGISTERED" | "CHECKED_IN" | "LEFT"
export type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED"
export type VisibilityLevel = "PUBLIC" | "CONNECTIONS" | "EVENT_ONLY" | "PRIVATE"
export type NotificationType =
  | "MATCH_SUGGESTION"
  | "CONNECTION_REQUEST"
  | "CONNECTION_ACCEPTED"
  | "MESSAGE"
  | "EVENT_REMINDER"
  | "ROTATION_PROMPT"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM"
export type QuestionType = "TEXT" | "MULTILINE" | "SELECT" | "MULTI_SELECT" | "SCALE"
export type KnowledgeNodeType =
  | "INTEREST"
  | "PROJECT"
  | "GOAL"
  | "SKILL"
  | "EXPERIENCE"
  | "IDEA"
  | "BOOK"
  | "TOPIC"
  | "PERSON"
  | "EVENT"

export interface User {
  id: string
  email: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface Profile {
  id: string
  userId: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  headline: string | null
  location: string | null
  website: string | null
  linkedinUrl: string | null
  instagramUrl: string | null
  githubUrl: string | null
  onboardingDone: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Interest {
  id: string
  name: string
  slug: string
  category: string | null
  emoji: string | null
}

export interface Event {
  id: string
  organizationId: string | null
  organizerId: string
  name: string
  slug: string
  description: string | null
  location: string | null
  coverImageUrl: string | null
  startTime: Date
  endTime: Date | null
  status: EventStatus
  maxAttendees: number | null
  isPublic: boolean
  qrCode: string | null
  rotationEnabled: boolean
  rotationMinutes: number | null
  createdAt: Date
  updatedAt: Date
}

export interface EventQuestion {
  id: string
  eventId: string
  text: string
  type: QuestionType
  options: string[] | null
  isRequired: boolean
  order: number
  placeholder: string | null
}

export interface Recommendation {
  id: string
  eventId: string
  userId: string
  recommendedUserId: string
  score: number
  reasons: string[]
  conversationStarters: string[] | null
  sharedInterests: string[] | null
  dismissed: boolean
}

// Composite types for UI
export interface ProfileWithInterests extends Profile {
  interests: Interest[]
}

export interface EventWithAttendees extends Event {
  attendees: Array<{
    userId: string
    status: AttendeeStatus
    checkedInAt: Date | null
  }>
  _count: { attendees: number }
}
