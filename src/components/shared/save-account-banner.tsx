"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Sparkles, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Value-first conversion for anonymous guests. Rendered only when the current
 * user is anonymous. Links an email + password to the SAME anonymous user, so
 * all their connections, answers, and mind-map data carry over automatically.
 */
export function SaveAccountBanner() {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  if (dismissed) return null

  async function save() {
    if (!email.includes("@") || password.length < 8) {
      toast.error("Enter a valid email and a password (8+ characters)")
      return
    }
    setSaving(true)
    const supabase = createClient()
    // Attaches credentials to the existing anonymous user → same id, data kept.
    const { error } = await supabase.auth.updateUser({ email, password })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Account saved! Check your email to confirm and secure it.")
    setExpanded(false)
    router.refresh()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <Sparkles className="size-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">You&apos;re exploring as a guest</p>
          <p className="text-sm text-muted-foreground">
            Save your account to keep your connections and grow your living mind map.
          </p>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="save-email" className="text-xs">Email</Label>
                    <Input
                      id="save-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="save-password" className="text-xs">Password</Label>
                    <Input
                      id="save-password"
                      type="password"
                      placeholder="8+ characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="gradient"
                  className="mt-3"
                  onClick={save}
                  loading={saving}
                >
                  Save my account
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!expanded && (
            <Button size="sm" variant="gradient" onClick={() => setExpanded(true)}>
              Save account
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
