"use client"

import { useState } from "react"
import { Play, Pause, Network } from "lucide-react"
import {
  NODE_COLORS,
  NODE_KIND_LABEL,
  type GraphNode,
  type GraphNodeKind,
  type KnowledgeGraph,
} from "@/lib/knowledge/types"
import { ForceGraph } from "./force-graph-3d"
import { NodeInspector } from "./node-inspector"

const LEGEND_KINDS: GraphNodeKind[] = [
  "interest",
  "project",
  "goal",
  "event",
  "person",
]

export function MindMap({ graph }: { graph: KnowledgeGraph }) {
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  return (
    <div className="relative w-full h-[calc(100vh-7rem)] rounded-2xl border overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      {/* Graph canvas */}
      <ForceGraph
        graph={graph}
        onSelect={setSelected}
        selectedId={selected?.id ?? null}
        autoRotate={autoRotate}
      />

      {/* Inspector */}
      <NodeInspector node={selected} onClose={() => setSelected(null)} />

      {/* Title + hint */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Network className="size-5 text-violet-400" />
          Your Mind Map
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Click a node to explore · drag to rotate · scroll to zoom
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setAutoRotate((r) => !r)}
          className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {autoRotate ? "Pause" : "Revolve"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-wrap gap-x-3 gap-y-1.5 max-w-[60%] justify-end">
        {LEGEND_KINDS.map((kind) => (
          <div key={kind} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: NODE_COLORS[kind] }}
            />
            <span className="text-[11px] text-slate-300">{NODE_KIND_LABEL[kind]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
