import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl font-bold text-muted-foreground/30">404</div>
        <div className="size-12 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mx-auto">
          <Compass className="size-6 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Page not found</h1>
          <p className="text-muted-foreground text-sm mt-1">
            This page wandered off. Let&apos;s get you back to discovering people.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="gradient" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
