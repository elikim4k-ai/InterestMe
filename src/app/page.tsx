import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Sparkles, Users, Zap } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white dark:from-violet-950/20 dark:via-background dark:to-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-xl">✦</span>
            InterestMe
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" variant="gradient" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="violet" className="mb-6 gap-1.5 px-4 py-1.5 text-sm">
          <Sparkles className="size-3" />
          AI-powered networking
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
          Discover{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
            people,
          </span>
          <br />
          not profiles.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          InterestMe transforms networking events into genuine human connections. Walk in knowing
          exactly who shares your passions, projects, and goals — before you say hello.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="xl" variant="gradient" asChild>
            <Link href="/signup">
              Start for free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Free forever for individuals · No credit card required
        </p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">
          Everything you need to network better
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          From event QR codes to AI-powered matches to a living knowledge graph.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="size-6 text-violet-600" />,
              title: "Instant Event Join",
              description:
                "Scan a QR code and you&apos;re in. Complete your event profile in under 2 minutes.",
            },
            {
              icon: <Sparkles className="size-6 text-indigo-600" />,
              title: "AI Matching",
              description:
                "Get matched with people who share your interests, goals, and projects — not just job titles.",
            },
            {
              icon: <Users className="size-6 text-pink-600" />,
              title: "Smart Rotations",
              description:
                "Organizers can run timed networking rounds with AI-suggested conversation partners.",
            },
          ].map(({ icon, title, description }) => (
            <div key={title} className="rounded-2xl border bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                {icon}
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to network differently?</h2>
          <p className="text-violet-200 mb-8 max-w-md mx-auto">
            Join thousands of professionals discovering meaningful connections at events worldwide.
          </p>
          <Button size="xl" className="bg-white text-violet-700 hover:bg-violet-50" asChild>
            <Link href="/signup">
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span>✦</span> InterestMe
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
          <p>© {new Date().getFullYear()} InterestMe</p>
        </div>
      </footer>
    </div>
  )
}
