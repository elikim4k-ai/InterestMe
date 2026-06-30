"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { GripVertical, Plus, Trash2, Sparkles } from "lucide-react"
import { createEvent } from "@/lib/actions/event"
import type { EventQuestionValues } from "@/lib/validations/event"
import type { QuestionType } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  TEXT: "Short text",
  MULTILINE: "Long text",
  SELECT: "Single choice",
  MULTI_SELECT: "Multiple choice",
  SCALE: "Scale (1–5)",
}

const SUGGESTED_QUESTIONS = [
  "What are you currently building?",
  "What are three surprising things about you?",
  "What do you hope to learn this year?",
  "Who are you hoping to meet?",
  "What's an unpopular opinion you have?",
  "What's something you could talk about for hours?",
]

type QuestionDraft = EventQuestionValues & { _id: string }

function newQuestion(text = ""): QuestionDraft {
  return {
    _id: crypto.randomUUID(),
    text,
    type: "MULTILINE",
    isRequired: false,
    options: undefined,
    placeholder: "",
  }
}

export function EventForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Core fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [rotationEnabled, setRotationEnabled] = useState(false)
  const [rotationMinutes, setRotationMinutes] = useState(15)

  // Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    newQuestion("What are you currently building?"),
  ])

  function updateQuestion(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q._id === id ? { ...q, ...patch } : q)))
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q._id !== id))
  }

  function addSuggested(text: string) {
    if (questions.length >= 15) return
    setQuestions((prev) => [...prev, newQuestion(text)])
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Please give your event a name")
      return
    }
    if (!startTime) {
      toast.error("Please set a start time")
      return
    }

    setSubmitting(true)
    const result = await createEvent({
      name,
      description,
      location,
      startTime,
      endTime,
      isPublic,
      rotationEnabled,
      rotationMinutes,
      questions: questions
        .filter((q) => q.text.trim())
        .map(({ _id, ...q }) => {
          void _id
          return q
        }),
    })
    setSubmitting(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Event created! 🎉")
    router.push(`/events/${result.data.id}/manage`)
    router.refresh()
  }

  const usedSuggestions = new Set(questions.map((q) => q.text))

  return (
    <div className="space-y-8">
      {/* Basics */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">Event details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="name">Event name *</Label>
            <Input
              id="name"
              placeholder="SF Founders Mixer · March 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this event about? Who should come?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="The Pearl, San Francisco"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start time *</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End time</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">Settings</h2>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public event</Label>
              <p className="text-sm text-muted-foreground">
                Anyone with the link or QR code can join
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                Smart rotations
                <Badge variant="violet" className="text-[10px]">
                  <Sparkles className="size-2.5 mr-0.5" /> AI
                </Badge>
              </Label>
              <p className="text-sm text-muted-foreground">
                Periodically suggest who attendees should meet next
              </p>
            </div>
            <Switch checked={rotationEnabled} onCheckedChange={setRotationEnabled} />
          </div>

          <AnimatePresence>
            {rotationEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 pl-4 border-l-2 border-violet-200 dark:border-violet-800">
                  <Label htmlFor="rotation">Rotation interval (minutes)</Label>
                  <Select
                    value={String(rotationMinutes)}
                    onValueChange={(v) => setRotationMinutes(Number(v))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 30].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Event questions</h2>
              <p className="text-sm text-muted-foreground">
                Everyone answers the same questions — this creates shared context.
              </p>
            </div>
            <Badge variant="secondary">{questions.length}/15</Badge>
          </div>

          {/* Suggested chips */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.filter((s) => !usedSuggestions.has(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSuggested(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-dashed hover:border-primary hover:bg-accent transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>

          {/* Question list */}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {questions.map((q, i) => (
                <motion.div
                  key={q._id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-xl border bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <GripVertical className="size-4 text-muted-foreground mt-2.5 shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Input
                        placeholder={`Question ${i + 1}`}
                        value={q.text}
                        onChange={(e) => updateQuestion(q._id, { text: e.target.value })}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Select
                          value={q.type}
                          onValueChange={(v) =>
                            updateQuestion(q._id, {
                              type: v as QuestionType,
                              options: ["SELECT", "MULTI_SELECT"].includes(v)
                                ? q.options ?? ["", ""]
                                : undefined,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                {QUESTION_TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <Switch
                            checked={q.isRequired}
                            onCheckedChange={(checked) =>
                              updateQuestion(q._id, { isRequired: checked })
                            }
                          />
                          Required
                        </label>
                      </div>

                      {/* Options editor for choice types */}
                      {["SELECT", "MULTI_SELECT"].includes(q.type) && (
                        <div className="space-y-2 pl-1">
                          {(q.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <Input
                                placeholder={`Option ${oi + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...(q.options ?? [])]
                                  opts[oi] = e.target.value
                                  updateQuestion(q._id, { options: opts })
                                }}
                                className="h-9"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = (q.options ?? []).filter((_, idx) => idx !== oi)
                                  updateQuestion(q._id, { options: opts })
                                }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(q._id, { options: [...(q.options ?? []), ""] })
                            }
                            className="text-xs text-primary hover:underline"
                          >
                            + Add option
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q._id)}
                      className="text-muted-foreground hover:text-destructive mt-2.5 shrink-0"
                      aria-label="Remove question"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {questions.length < 15 && (
            <Button
              variant="outline"
              onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
              className="w-full border-dashed"
            >
              <Plus className="size-4" />
              Add custom question
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 sticky bottom-4">
        <Button
          size="lg"
          variant="gradient"
          onClick={handleSubmit}
          loading={submitting}
          className="shadow-xl"
        >
          Create event ✦
        </Button>
      </div>
    </div>
  )
}
