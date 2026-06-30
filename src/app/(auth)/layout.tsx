import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">✦</span>
            InterestMe
          </Link>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              Discover people,<br />not profiles.
            </h1>
            <p className="text-violet-200 text-lg leading-relaxed max-w-md">
              Walk into any networking event and immediately know who shares your passions, projects, and goals — before you even say hello.
            </p>
            <div className="flex flex-col gap-4">
              {[
                { emoji: "🎯", text: "AI-powered match recommendations" },
                { emoji: "🗺️", text: "Personal interest knowledge graph" },
                { emoji: "⚡", text: "Real-time smart networking rounds" },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3 text-violet-100">
                  <span className="text-xl">{emoji}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-violet-300 text-sm">
            © {new Date().getFullYear()} InterestMe. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <span className="text-2xl">✦</span>
              InterestMe
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
