"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { updateEvent } from "@/lib/actions/event"
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

export interface EditEventInitial {
  id: string
  name: string
  description: string
  location: string
  startTime: string // ISO (UTC) — converted to local for the input
  endTime: string // ISO (UTC) or ""
  isPublic: boolean
  rotationEnabled: boolean
  rotationMinutes: number
}

/** ISO/UTC → the "YYYY-MM-DDTHH:mm" local value a datetime-local input expects. */
function toLocalInput(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditEventForm({ initial }: { initial: EditEventInitial }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [location, setLocation] = useState(initial.location)
  const [startTime, setStartTime] = useState(() => toLocalInput(initial.startTime))
  const [endTime, setEndTime] = useState(() => toLocalInput(initial.endTime))
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [rotationEnabled, setRotationEnabled] = useState(initial.rotationEnabled)
  const [rotationMinutes, setRotationMinutes] = useState(initial.rotationMinutes || 15)

  async function handleSave() {
    if (!name.trim()) return toast.error("Please give your event a name")
    if (!startTime) return toast.error("Please set a start time")

    setSaving(true)
    const result = await updateEvent(initial.id, {
      name,
      description,
      location,
      startTime,
      endTime,
      isPublic,
      rotationEnabled,
      rotationMinutes,
    })
    setSaving(false)

    if (!result.success) return toast.error(result.error)
    toast.success("Event updated")
    router.push(`/events/${initial.id}/manage`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">Event details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="name">Event name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
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
                Start a shared conversation timer when people connect
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
                  <Label htmlFor="rotation">Conversation length (minutes)</Label>
                  <Select
                    value={String(rotationMinutes)}
                    onValueChange={(val) => setRotationMinutes(Number(val))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 30].map((m) => (
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

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button variant="gradient" onClick={handleSave} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  )
}
