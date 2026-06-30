import type { Metadata } from "next"

export const dynamic = "force-dynamic"
import { OnboardingWizard } from "@/components/forms/onboarding-wizard"

export const metadata: Metadata = { title: "Set up your profile" }

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 space-y-2">
          <div className="text-3xl mb-4">✦</div>
          <h1 className="text-3xl font-bold">Let&apos;s build your profile</h1>
          <p className="text-muted-foreground">
            Tell us about yourself — this is how people will discover you at events.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  )
}
