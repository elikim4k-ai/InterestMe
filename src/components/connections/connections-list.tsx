"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, X, MessageCircle, Loader2 } from "lucide-react"
import { respondToConnection, type ConnectionPerson } from "@/lib/actions/connection"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export function ConnectionsList({
  incoming,
  accepted,
}: {
  incoming: ConnectionPerson[]
  accepted: ConnectionPerson[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [localIncoming, setLocalIncoming] = useState(incoming)

  async function respond(c: ConnectionPerson, accept: boolean) {
    setPending((p) => ({ ...p, [c.connectionId]: true }))
    const res = await respondToConnection(c.connectionId, accept)
    if (!res.success) {
      setPending((p) => ({ ...p, [c.connectionId]: false }))
      toast.error(res.error)
      return
    }
    setLocalIncoming((list) => list.filter((x) => x.connectionId !== c.connectionId))
    toast.success(accept ? `You're connected with ${c.name} 🤝` : "Request declined")
    router.refresh()
  }

  const hasNothing = localIncoming.length === 0 && accepted.length === 0

  if (hasNothing) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-5xl">🤝</div>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm">
          No connections yet. Meet people at events and connect with them from Discover.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {localIncoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Wants to connect ({localIncoming.length})
          </h2>
          <div className="space-y-3">
            {localIncoming.map((c) => (
              <Card key={c.connectionId}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={c.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{initialsOf(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.headline && (
                      <p className="text-sm text-muted-foreground truncate">{c.headline}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="gradient"
                      onClick={() => respond(c, true)}
                      disabled={pending[c.connectionId]}
                    >
                      {pending[c.connectionId] ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="size-4" /> Accept
                        </>
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => respond(c, false)}
                      disabled={pending[c.connectionId]}
                      aria-label="Decline"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {accepted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Your connections ({accepted.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {accepted.map((c) => (
              <Card key={c.connectionId}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={c.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{initialsOf(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.headline && (
                      <p className="text-sm text-muted-foreground truncate">{c.headline}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/messages/${c.userId}`}>
                      <MessageCircle className="size-4" /> Chat
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
