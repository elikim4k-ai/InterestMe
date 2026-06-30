import type { Metadata } from "next"
import { SignupForm } from "@/components/forms/signup-form"

export const metadata: Metadata = {
  title: "Create Account",
}

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          Join InterestMe and start making genuine connections
        </p>
      </div>
      <SignupForm />
    </div>
  )
}
