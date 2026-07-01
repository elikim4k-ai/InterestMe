"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * Lets a guest sign out of their anonymous session so a *different* person can
 * join on the same device (shared/kiosk use, or testing multiple guests in one
 * browser). Only meaningful for anonymous users — signing out discards the
 * unsaved guest session.
 */
export function GuestResetLink() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function startOver() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <p className="text-center text-xs text-muted-foreground">
      Not you?{" "}
      <button
        type="button"
        onClick={startOver}
        disabled={busy}
        className="text-primary hover:underline disabled:opacity-50"
      >
        Start over as someone else
      </button>
    </p>
  )
}
