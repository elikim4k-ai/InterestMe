import { z } from "zod"

export const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters").max(60),
  headline: z.string().max(120, "Keep it under 120 characters").optional().or(z.literal("")),
  bio: z.string().max(500, "Keep it under 500 characters").optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagramUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  githubUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
})

export type ProfileValues = z.infer<typeof profileSchema>

export const interestsSchema = z.object({
  interests: z.array(z.string().min(1)).max(10, "Pick up to 10 interests"),
})

export const goalsSchema = z.object({
  goals: z.array(z.string().min(1).max(200)).max(5, "Up to 5 goals"),
})

export const projectSchema = z.object({
  title: z.string().min(2, "Title required").max(100),
  description: z.string().max(500).optional().or(z.literal("")),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["active", "paused", "completed"]).default("active"),
})

export type ProjectValues = z.infer<typeof projectSchema>
