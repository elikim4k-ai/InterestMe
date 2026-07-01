"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { completeOnboarding } from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const INTEREST_OPTIONS = [
  "Software Engineering", "Artificial Intelligence", "Design", "Startups",
  "Finance", "Gaming", "Music", "Writing", "Sustainability", "Research",
  "Arts & Culture", "Fitness", "Travel", "Food", "Photography", "Science",
  "Hardware", "Mobile", "Education", "Health Tech",
]

/**
 * Logged-out entry point for a public event. A single "Join" button that does a
 * silent anonymous sign-in — no signup wall. A quiet sign-in link remains for
 * returning users.
 */
export function GuestJoinButton({
  eventSlug,
  questionCount,
}: {
  eventSlug: string
  questionCount: number
}) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)

  async function joinAsGuest() {
    setJoining(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      setJoining(false)
      toast.error(
        error.message.includes("disabled")
          ? "Guest access isn't enabled yet. Please sign in instead."
          : error.message
      )
      return
    }
    // Session cookie is set — re-render the server page as the new guest user.
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        variant="gradient"
        className="w-full"
        onClick={joinAsGuest}
        loading={joining}
      >
        <Sparkles className="size-4" />
        Join this event
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {questionCount} quick questions · No account needed to start
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?redirectTo=/event/${eventSlug}`}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

/**
 * Lightweight guest profile: name + interests only. Reuses completeOnboarding
 * (goals empty) so guests flow through the exact same validated path as members.
 */
export function GuestProfileForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  function toggle(label: string) {
    setInterests((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : prev.length < 10
        ? [...prev, label]
        : prev
    )
  }

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Please enter your name")
      return
    }
    setSubmitting(true)
    const result = await completeOnboarding({
      profile: { displayName: name.trim() },
      interests,
      goals: [],
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Tell us a bit about you</h2>
            <p className="text-sm text-muted-foreground">
              Just enough to find the people you should meet. Takes 20 seconds.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Your name</Label>
            <Input
              id="guest-name"
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Your interests</Label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle(label)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                    interests.includes(label)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{interests.length}/10 selected</p>
          </div>

          <Button
            size="lg"
            variant="gradient"
            className="w-full"
            onClick={submit}
            loading={submitting}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
