"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for monitoring (Sentry hooks in here in production).
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="size-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm mt-1">
            An unexpected error occurred. You can try again — if it keeps
            happening, we&apos;re on it.
          </p>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="gradient">
            Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
