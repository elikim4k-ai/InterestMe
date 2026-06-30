"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" className="w-full" onClick={copy}>
      {copied ? (
        <>
          <Check className="size-4" /> Copied!
        </>
      ) : (
        <>
          <Copy className="size-4" /> Copy join link
        </>
      )}
    </Button>
  )
}
