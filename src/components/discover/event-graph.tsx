"use client"

import { useEffect, useState } from "react"
import { Play, Pause, Loader2, Network } from "lucide-react"
import { getEventGraph } from "@/lib/actions/event-graph"
import {
  NODE_COLORS,
  type GraphNode,
  type KnowledgeGraph,
} from "@/lib/knowledge/types"
import { ForceGraph } from "@/components/mindmap/force-graph-3d"
import { NodeInspector } from "@/components/mindmap/node-inspector"
import { FindOverlay } from "./find-overlay"
import { Button } from "@/components/ui/button"
import { Navigation } from "lucide-react"
import { cn } from "@/lib/utils"

type Scope = "mine" | "room"

export function EventGraph({
  eventId,
  meUserId,
  meName,
}: {
  eventId: string
  meUserId: string
  meName: string
}) {
  const [scope, setScope] = useState<Scope>("mine")
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [finding, setFinding] = useState<{ userId: string; name: string } | null>(null)

  const canFind =
    selected && (selected.kind === "person" || selected.kind === "match") && selected.id !== "me"

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getEventGraph(eventId, scope).then((res) => {
      if (cancelled) return
      setGraph(res.success ? res.data : { nodes: [], links: [] })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [eventId, scope])

  const hasGraph = graph && graph.nodes.length > 1

  return (
    <div className="relative w-full h-[70vh] rounded-2xl border overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      {/* Scope toggle */}
      <div className="absolute top-4 left-4 z-10 flex rounded-full bg-white/10 backdrop-blur-md p-1 text-xs">
        <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
          Your connections
        </ScopeButton>
        <ScopeButton active={scope === "room"} onClick={() => setScope("room")}>
          Whole room
        </ScopeButton>
      </div>

      {/* Title */}
      <div className="absolute top-4 right-4 z-10 text-right pointer-events-none">
        <h2 className="flex items-center justify-end gap-1.5 text-sm font-bold text-white">
          <Network className="size-4 text-violet-400" />
          Event Map
        </h2>
      </div>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin mr-2" /> Mapping the room…
        </div>
      ) : hasGraph ? (
        <>
          <ForceGraph
            graph={graph!}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
            autoRotate={autoRotate}
            showZoomControls
            distanceByStrength
          />
          <NodeInspector
            node={selected}
            onClose={() => setSelected(null)}
            action={
              canFind ? (
                <Button
                  size="sm"
                  variant="gradient"
                  className="w-full"
                  onClick={() => setFinding({ userId: selected!.id, name: selected!.label })}
                >
                  <Navigation className="size-4" />
                  Find {selected!.label}
                </Button>
              ) : null
            }
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <p className="text-sm text-slate-400 max-w-xs">
            {scope === "mine"
              ? "No connections yet — as people join and match with you, they'll appear here."
              : "No shared-interest links yet. More attendees will fill out the map."}
          </p>
        </div>
      )}

      {/* Controls */}
      {hasGraph && (
        <button
          onClick={() => setAutoRotate((r) => !r)}
          className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {autoRotate ? "Pause" : "Revolve"}
        </button>
      )}

      {/* Legend (bottom-center to avoid the revolve + zoom controls) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        <LegendDot color={NODE_COLORS.match} label="AI match" />
        <LegendDot color={NODE_COLORS.person} label="Attendee" />
      </div>

      {finding && (
        <FindOverlay
          eventId={eventId}
          meUserId={meUserId}
          meName={meName}
          target={finding}
          onClose={() => setFinding(null)}
        />
      )}
    </div>
  )
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full font-medium transition-colors",
        active ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  )
}
