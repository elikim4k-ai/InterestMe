"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Check, Sparkles } from "lucide-react"
import { joinEvent, submitAnswers, checkInToEvent } from "@/lib/actions/event"
import type { QuestionType } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Question {
  id: string
  text: string
  type: QuestionType
  options: string[] | null
  is_required: boolean
  placeholder: string | null
  order: number
}

interface EventJoinPanelProps {
  eventId: string
  eventSlug: string
  alreadyJoined: boolean
  checkedIn: boolean
  questions: Question[]
  existingAnswers: Record<string, string>
}

export function EventJoinPanel({
  eventId,
  alreadyJoined,
  checkedIn,
  questions,
  existingAnswers,
}: EventJoinPanelProps) {
  const router = useRouter()
  const [joined, setJoined] = useState(alreadyJoined)
  const [joining, setJoining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>(existingAnswers)

  async function handleJoin() {
    setJoining(true)
    const result = await joinEvent(eventId)
    setJoining(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setJoined(true)
    toast.success("You're in! Answer the questions to get better matches.")
    router.refresh()
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function toggleMultiSelect(questionId: string, option: string) {
    const current = answers[questionId] ? answers[questionId]!.split("|||") : []
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option]
    setAnswer(questionId, next.join("|||"))
  }

  /**
   * Single next step after filling answers: save them, check in (if needed),
   * then go discover people. Replaces the separate "Save answers" button.
   */
  async function handleDiscover() {
    const missing = questions.filter((q) => q.is_required && !answers[q.id]?.trim())
    if (missing.length > 0) {
      toast.error(`Please answer: "${missing[0]!.text}"`)
      return
    }

    setSaving(true)

    // Persist answers (skip the call when there's nothing to save).
    if (Object.keys(answers).length > 0) {
      const saved = await submitAnswers({
        eventId,
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
      })
      if (!saved.success) {
        setSaving(false)
        toast.error(saved.error)
        return
      }
    }

    // Check in on first pass.
    if (!checkedIn) {
      const result = await checkInToEvent(eventId)
      if (!result.success) {
        setSaving(false)
        toast.error(result.error)
        return
      }
    }

    router.push("/discover")
    router.refresh()
  }

  if (!joined) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-4xl">👋</div>
          <div>
            <h2 className="font-semibold">Join this event</h2>
            <p className="text-sm text-muted-foreground">
              Answer {questions.length} quick questions and start discovering people.
            </p>
          </div>
          <Button
            size="lg"
            variant="gradient"
            className="w-full"
            onClick={handleJoin}
            loading={joining}
          >
            Join event
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3"
      >
        <Check className="size-4 text-emerald-600 shrink-0" />
        <span className="text-sm text-emerald-700 dark:text-emerald-300">
          {checkedIn ? "You're checked in" : "You've joined this event"}
        </span>
      </motion.div>

      {/* Questions */}
      {questions.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold">Your answers</h2>
              <p className="text-sm text-muted-foreground">
                These help others discover what you&apos;re about.
              </p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <Label className="flex items-start gap-1.5">
                  <span className="text-muted-foreground text-sm">{i + 1}.</span>
                  <span>
                    {q.text}
                    {q.is_required && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                </Label>
                <QuestionInput
                  question={q}
                  value={answers[q.id] ?? ""}
                  onChange={(v) => setAnswer(q.id, v)}
                  onToggle={(opt) => toggleMultiSelect(q.id, opt)}
                />
              </div>
            ))}

          </CardContent>
        </Card>
      )}

      {/* Single next step: saves answers, checks in, then discovers */}
      <Button
        size="lg"
        variant="gradient"
        className="w-full"
        onClick={handleDiscover}
        loading={saving}
      >
        <Sparkles className="size-4" />
        Discover people
      </Button>
    </div>
  )
}

function QuestionInput({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: Question
  value: string
  onChange: (v: string) => void
  onToggle: (opt: string) => void
}) {
  switch (question.type) {
    case "TEXT":
      return (
        <Input
          placeholder={question.placeholder ?? "Your answer"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "MULTILINE":
      return (
        <Textarea
          placeholder={question.placeholder ?? "Your answer"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      )
    case "SELECT":
      return (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-all",
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:border-primary/50 hover:bg-accent"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )
    case "MULTI_SELECT": {
      const selected = value ? value.split("|||") : []
      return (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-all",
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:border-primary/50 hover:bg-accent"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )
    }
    case "SCALE":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={cn(
                "size-10 rounded-xl border text-sm font-medium transition-all",
                value === String(n)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:border-primary/50 hover:bg-accent"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )
    default:
      return null
  }
}
