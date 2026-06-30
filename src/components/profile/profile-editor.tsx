"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { updateProfile, setInterests, setGoals } from "@/lib/actions/profile"
import { profileSchema, type ProfileValues } from "@/lib/validations/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const INTEREST_OPTIONS = [
  "Software Engineering", "Artificial Intelligence", "Design", "Startups",
  "Finance", "Gaming", "Music", "Writing", "Sustainability", "Research",
  "Arts & Culture", "Fitness", "Travel", "Food", "Photography", "Science",
  "Hardware", "Mobile", "Education", "Health Tech",
]

interface ProfileEditorProps {
  initial: ProfileValues
  initialInterests: string[]
  initialGoals: string[]
}

export function ProfileEditor({
  initial,
  initialInterests,
  initialGoals,
}: ProfileEditorProps) {
  const router = useRouter()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
  const [savingGoals, setSavingGoals] = useState(false)

  const [interests, setInterestsState] = useState<string[]>(initialInterests)
  const [goals, setGoalsState] = useState<string[]>(
    initialGoals.length ? initialGoals : [""]
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  })

  async function onSaveProfile(values: ProfileValues) {
    setSavingProfile(true)
    const result = await updateProfile(values)
    setSavingProfile(false)
    if (!result.success) return toast.error(result.error)
    toast.success("Profile updated")
    router.refresh()
  }

  function toggleInterest(label: string) {
    setInterestsState((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : prev.length < 10
        ? [...prev, label]
        : prev
    )
  }

  async function onSaveInterests() {
    setSavingInterests(true)
    const result = await setInterests(interests)
    setSavingInterests(false)
    if (!result.success) return toast.error(result.error)
    toast.success("Interests updated")
    router.refresh()
  }

  async function onSaveGoals() {
    setSavingGoals(true)
    const result = await setGoals(goals.filter((g) => g.trim()))
    setSavingGoals(false)
    if (!result.success) return toast.error(result.error)
    toast.success("Goals updated")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" error={errors.displayName?.message} {...register("displayName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input id="headline" error={errors.headline?.message} {...register("headline")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={3} error={errors.bio?.message} {...register("bio")} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" error={errors.location?.message} {...register("location")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://" error={errors.website?.message} {...register("website")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input id="linkedinUrl" placeholder="https://linkedin.com/in/…" error={errors.linkedinUrl?.message} {...register("linkedinUrl")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="githubUrl">GitHub</Label>
                <Input id="githubUrl" placeholder="https://github.com/…" error={errors.githubUrl?.message} {...register("githubUrl")} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((label) => {
              const selected = interests.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleInterest(label)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{interests.length}/10 selected</span>
            <Button size="sm" onClick={onSaveInterests} loading={savingInterests}>
              Save interests
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((goal, i) => (
            <Input
              key={i}
              value={goal}
              placeholder={`Goal ${i + 1}`}
              onChange={(e) =>
                setGoalsState((prev) => {
                  const next = [...prev]
                  next[i] = e.target.value
                  return next
                })
              }
            />
          ))}
          <div className="flex items-center justify-between">
            {goals.length < 5 ? (
              <button
                type="button"
                onClick={() => setGoalsState((prev) => [...prev, ""])}
                className="text-sm text-primary hover:underline"
              >
                + Add goal
              </button>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={onSaveGoals} loading={savingGoals}>
              Save goals
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
