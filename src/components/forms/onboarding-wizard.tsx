"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { completeOnboarding } from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── Schema ────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  headline: z.string().max(120, "Keep it under 120 characters").optional(),
  bio: z.string().max(500, "Keep it under 500 characters").optional(),
  location: z.string().optional(),
})

type Step1Values = z.infer<typeof step1Schema>

// ─── Interest categories ────────────────────────────────────────────────────

const INTEREST_OPTIONS = [
  { emoji: "💻", label: "Software Engineering" },
  { emoji: "🤖", label: "Artificial Intelligence" },
  { emoji: "🎨", label: "Design" },
  { emoji: "🚀", label: "Startups" },
  { emoji: "📈", label: "Finance" },
  { emoji: "🎮", label: "Gaming" },
  { emoji: "🎵", label: "Music" },
  { emoji: "📚", label: "Writing" },
  { emoji: "🌱", label: "Sustainability" },
  { emoji: "🔬", label: "Research" },
  { emoji: "🎭", label: "Arts & Culture" },
  { emoji: "🏃", label: "Fitness" },
  { emoji: "🌍", label: "Travel" },
  { emoji: "🍳", label: "Food" },
  { emoji: "📸", label: "Photography" },
  { emoji: "⚗️", label: "Science" },
  { emoji: "🏗️", label: "Hardware" },
  { emoji: "📱", label: "Mobile" },
  { emoji: "🎓", label: "Education" },
  { emoji: "💊", label: "Health Tech" },
]

const STEPS = ["About You", "Your Interests", "Your Goals", "Done!"]

// ─── Component ─────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([""])
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<Step1Values>({ resolver: zodResolver(step1Schema) })

  function toggleInterest(label: string) {
    setSelectedInterests((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : prev.length < 10
        ? [...prev, label]
        : prev
    )
  }

  function updateGoal(index: number, value: string) {
    setGoals((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  function addGoal() {
    if (goals.length < 5) setGoals((prev) => [...prev, ""])
  }

  async function handleFinish() {
    setSubmitting(true)
    const values = getValues()

    const result = await completeOnboarding({
      profile: values,
      interests: selectedInterests,
      goals: goals.filter((g) => g.trim().length > 0),
    })

    setSubmitting(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Profile created! Welcome to InterestMe 🎉")
    router.push("/dashboard")
    router.refresh()
  }

  async function handleStep1Submit(values: Step1Values) {
    void values
    setStep(1)
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Progress */}
      <div className="px-8 pt-8 pb-6 border-b">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 md:w-16 transition-all",
                    i < step ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "text-xs font-medium",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Your name *</Label>
                  <Input
                    id="displayName"
                    placeholder="Alex Johnson"
                    error={errors.displayName?.message}
                    {...register("displayName")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    placeholder="e.g. Founder @ Startup · Builder · Curious human"
                    {...register("headline")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Short bio</Label>
                  <textarea
                    id="bio"
                    placeholder="Tell people who you are beyond your job title..."
                    rows={3}
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none transition-shadow"
                    {...register("bio")}
                  />
                  {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="San Francisco, CA" {...register("location")} />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Continue →
                </Button>
              </form>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div>
                <h2 className="font-semibold mb-1">What are you interested in?</h2>
                <p className="text-sm text-muted-foreground">
                  Pick up to 10. This powers your AI matches.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map(({ emoji, label }) => {
                  const selected = selectedInterests.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleInterest(label)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                      )}
                    >
                      {emoji} {label}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selectedInterests.length}/10 selected
                </span>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(0)} className="flex-1">
                  ← Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  className="flex-1"
                  disabled={selectedInterests.length === 0}
                >
                  Continue →
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div>
                <h2 className="font-semibold mb-1">What are your goals?</h2>
                <p className="text-sm text-muted-foreground">
                  What are you hoping to achieve, learn, or find this year?
                </p>
              </div>
              <div className="space-y-3">
                {goals.map((goal, i) => (
                  <Input
                    key={i}
                    value={goal}
                    onChange={(e) => updateGoal(i, e.target.value)}
                    placeholder={
                      i === 0
                        ? "e.g. Find a technical co-founder"
                        : i === 1
                        ? "e.g. Learn more about machine learning"
                        : "Add another goal..."
                    }
                  />
                ))}
                {goals.length < 5 && (
                  <button
                    type="button"
                    onClick={addGoal}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add another goal
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Continue →
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-6 py-4"
            >
              <div className="text-6xl">🎉</div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">You&apos;re all set!</h2>
                <p className="text-muted-foreground">
                  Your profile is ready. Join your first event to start discovering people.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {selectedInterests.slice(0, 5).map((interest) => (
                  <Badge key={interest} variant="violet">
                    {interest}
                  </Badge>
                ))}
                {selectedInterests.length > 5 && (
                  <Badge variant="outline">+{selectedInterests.length - 5} more</Badge>
                )}
              </div>
              <Button
                size="lg"
                variant="gradient"
                className="w-full"
                onClick={handleFinish}
                loading={submitting}
              >
                Enter InterestMe ✦
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
