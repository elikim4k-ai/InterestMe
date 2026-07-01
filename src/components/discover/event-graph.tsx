"use client"

import { useEffect, useState } from "react"
import { Play, Pause, Loader2, Network, Maximize2, Minimize2, Navigation } from "lucide-react"
import { getEventGraph } from "@/lib/actions/event-graph"
import {
  NODE_COLORS,
  type GraphNode,
  type KnowledgeGraph,
} from "@/lib/knowledge/types"
import { ForceGraph } from "@/components/mindmap/force-graph-3d"
import { NodeInspector } from "@/components/mindmap/node-inspector"
import { useLocationShare } from "./location-share"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Scope = "mine" | "room"

export function EventGraph({ eventId }: { eventId: string }) {
  const { find } = useLocationShare()
  const [scope, setScope] = useState<Scope>("mine")
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  // Collapsed by default so the page scrolls past it on mobile; tap to interact.
  const [expanded, setExpanded] = useState(false)

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
  const canFind =
    selected && (selected.kind === "person" || selected.kind === "match") && selected.id !== "me"

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black transition-[height] duration-300",
        expanded ? "h-[80vh]" : "h-[38vh]"
      )}
    >
      {/* Graph canvas — non-interactive until expanded so the page can scroll */}
      <div className={cn("absolute inset-0", !expanded && "pointer-events-none")}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin mr-2" /> Mapping the room…
          </div>
        ) : hasGraph ? (
          <ForceGraph
            graph={graph!}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
            autoRotate={autoRotate && expanded}
            showZoomControls={expanded}
            distanceByStrength
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <p className="text-sm text-slate-400 max-w-xs">
              {scope === "mine"
                ? "No connections yet — as people join and match with you, they'll appear here."
                : "No shared-interest links yet. More attendees will fill out the map."}
            </p>
          </div>
        )}
      </div>

      {/* Collapsed: a tap target to enter interactive mode (rest scrolls the page) */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center pb-4 z-10"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-4 py-2 text-sm font-medium text-white">
            <Maximize2 className="size-4" /> Tap to explore the map
          </span>
        </button>
      )}

      {/* Title */}
      <div className="absolute top-4 right-4 z-20 text-right pointer-events-none">
        <h2 className="flex items-center justify-end gap-1.5 text-sm font-bold text-white">
          <Network className="size-4 text-violet-400" />
          Event Map
        </h2>
      </div>

      {/* Interactive-only chrome */}
      {expanded && (
        <>
          {/* Scope toggle */}
          <div className="absolute top-4 left-4 z-20 flex rounded-full bg-white/10 backdrop-blur-md p-1 text-xs">
            <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
              Your connections
            </ScopeButton>
            <ScopeButton active={scope === "room"} onClick={() => setScope("room")}>
              Whole room
            </ScopeButton>
          </div>

          <NodeInspector
            node={selected}
            onClose={() => setSelected(null)}
            action={
              canFind ? (
                <Button
                  size="sm"
                  variant="gradient"
                  className="w-full"
                  onClick={() => find({ userId: selected!.id, name: selected!.label })}
                >
                  <Navigation className="size-4" />
                  Find {selected!.label}
                </Button>
              ) : null
            }
          />

          {/* Minimize */}
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <Minimize2 className="size-3.5" /> Minimize
          </button>

          {hasGraph && (
            <button
              onClick={() => setAutoRotate((r) => !r)}
              className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {autoRotate ? "Pause" : "Revolve"}
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-3">
            <LegendDot color={NODE_COLORS.match} label="AI match" />
            <LegendDot color={NODE_COLORS.person} label="Attendee" />
          </div>
        </>
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
