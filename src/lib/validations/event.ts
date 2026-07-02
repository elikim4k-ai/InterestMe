import { z } from "zod"

export const questionTypeEnum = z.enum([
  "TEXT",
  "MULTILINE",
  "SELECT",
  "MULTI_SELECT",
  "SCALE",
])

export const eventQuestionSchema = z
  .object({
    text: z.string().min(3, "Question must be at least 3 characters").max(200),
    type: questionTypeEnum.default("MULTILINE"),
    options: z.array(z.string().min(1)).optional(),
    isRequired: z.boolean().default(false),
    placeholder: z.string().max(120).optional().or(z.literal("")),
  })
  .refine(
    (q) =>
      !["SELECT", "MULTI_SELECT"].includes(q.type) ||
      (q.options && q.options.length >= 2),
    { message: "Choice questions need at least 2 options", path: ["options"] }
  )

export const createEventSchema = z.object({
  name: z.string().min(3, "Event name must be at least 3 characters").max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional().or(z.literal("")),
  isPublic: z.boolean().default(true),
  maxAttendees: z.coerce.number().int().positive().optional(),
  rotationEnabled: z.boolean().default(false),
  rotationMinutes: z.coerce.number().int().min(5).max(60).optional(),
  questions: z.array(eventQuestionSchema).max(15, "Up to 15 questions").default([]),
})

export type CreateEventValues = z.infer<typeof createEventSchema>
export type EventQuestionValues = z.infer<typeof eventQuestionSchema>

/** Editing an existing event covers its core fields (not the question set). */
export const updateEventSchema = createEventSchema.omit({ questions: true })
export type UpdateEventValues = z.infer<typeof updateEventSchema>

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().max(2000),
})

export const submitAnswersSchema = z.object({
  eventId: z.string().uuid(),
  answers: z.array(answerSchema),
})

export type SubmitAnswersValues = z.infer<typeof submitAnswersSchema>
