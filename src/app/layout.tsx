import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/shared/providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

/** Resolve a valid absolute base URL; tolerate empty/invalid env values. */
function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (raw) {
    try {
      return new URL(raw).toString()
    } catch {
      /* fall through to default */
    }
  }
  return "http://localhost:3000"
}

const appUrl = resolveAppUrl()

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "InterestMe — Discover people, not profiles",
    template: "%s | InterestMe",
  },
  description:
    "InterestMe helps you genuinely discover the people at networking events through shared interests, projects, and passions — not job titles.",
  keywords: ["networking", "events", "interests", "connections", "community"],
  openGraph: {
    type: "website",
    siteName: "InterestMe",
    url: appUrl,
    title: "InterestMe — Discover people, not profiles",
    description: "Transform networking events into genuine human connections.",
  },
  twitter: {
    card: "summary_large_image",
    title: "InterestMe — Discover people, not profiles",
    description: "Transform networking events into genuine human connections.",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d17" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
