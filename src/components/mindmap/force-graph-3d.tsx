"use client"

import type { ComponentType } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import * as THREE from "three"
import type { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-3d"
import { NODE_COLORS, type GraphNode, type KnowledgeGraph } from "@/lib/knowledge/types"

// react-force-graph-3d touches `window`/WebGL → never SSR it.
// The dynamic() wrapper erases the component's generic, so we re-type it as a
// permissive component and narrow node/link objects ourselves at the boundary.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Loading your universe…
    </div>
  ),
}) as unknown as ComponentType<Record<string, unknown>>

type GNode = GraphNode & NodeObject

/** Narrow a library NodeObject back to our domain node. */
function asGNode(n: NodeObject | string): GNode {
  return (typeof n === "string" ? { id: n } : n) as GNode
}

function endpointId(end: string | number | NodeObject | undefined): string {
  if (end === undefined || end === null) return ""
  if (typeof end === "string") return end
  if (typeof end === "number") return String(end)
  return String((end as GNode).id ?? "")
}

interface ForceGraphProps {
  graph: KnowledgeGraph
  onSelect: (node: GraphNode | null) => void
  selectedId: string | null
  autoRotate: boolean
}

export function ForceGraph({ graph, onSelect, selectedId, autoRotate }: ForceGraphProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const angleRef = useRef(0)

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect
      setDims({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Precompute neighbor adjacency for hover/selection highlighting
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of graph.links) {
      const s = endpointId(link.source as string | NodeObject)
      const t = endpointId(link.target as string | NodeObject)
      if (!map.has(s)) map.set(s, new Set())
      if (!map.has(t)) map.set(t, new Set())
      map.get(s)!.add(t)
      map.get(t)!.add(s)
    }
    return map
  }, [graph.links])

  const activeId = hoverId ?? selectedId

  function isHighlighted(nodeId: string): boolean {
    if (!activeId) return true
    if (nodeId === activeId) return true
    return adjacency.get(activeId)?.has(nodeId) ?? false
  }

  // Auto-revolving camera orbit
  useEffect(() => {
    if (!autoRotate) return
    const distance = 320
    let frame: number
    const tick = () => {
      const fg = fgRef.current
      if (fg) {
        angleRef.current += 0.0016
        fg.cameraPosition({
          x: distance * Math.sin(angleRef.current),
          z: distance * Math.cos(angleRef.current),
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [autoRotate])

  // Initial camera framing
  useEffect(() => {
    const fg = fgRef.current
    if (fg) {
      fg.cameraPosition({ x: 0, y: 0, z: 320 })
      // Spread the graph out a bit for legibility
      fg.d3Force("charge")?.strength(-120)
    }
  }, [])

  // Build a node as a glowing sphere + text sprite
  const nodeThreeObject = useCallback(
    (node: GNode) => {
      const color = NODE_COLORS[node.kind] ?? "#8b5cf6"
      const highlighted = isHighlighted(node.id!)
      const radius = 3 + (node.val ?? 0.3) * 9

      const group = new THREE.Group()

      // Sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: highlighted ? 1 : 0.15,
        })
      )
      group.add(sphere)

      // Soft glow halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.6, 16, 16),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: highlighted ? 0.18 : 0.04,
        })
      )
      group.add(halo)

      // Text label (skip leaf labels when zoomed out is handled by size)
      if (node.kind !== "category" || true) {
        const sprite = makeTextSprite(node.label, highlighted)
        sprite.position.set(0, radius + 6, 0)
        group.add(sprite)
      }

      return group
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId]
  )

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        graphData={graph}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeLabel={() => ""}
        nodeThreeObject={(node: NodeObject) => nodeThreeObject(asGNode(node))}
        nodeThreeObjectExtend={false}
        linkColor={(link: LinkObject) => {
          const s = endpointId(link.source)
          const t = endpointId(link.target)
          const on = !activeId || (isHighlighted(s) && isHighlighted(t))
          return on ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.06)"
        }}
        linkWidth={(link: LinkObject) => {
          const s = endpointId(link.source)
          return activeId && s === activeId ? 1.2 : 0.4
        }}
        linkDirectionalParticles={0}
        onNodeHover={(node: NodeObject | null) => {
          setHoverId(node ? (asGNode(node).id ?? null) : null)
          if (containerRef.current) {
            containerRef.current.style.cursor = node ? "pointer" : "grab"
          }
        }}
        onNodeClick={(node: NodeObject) => {
          const n = asGNode(node)
          onSelect({
            id: n.id!,
            label: n.label,
            kind: n.kind,
            val: n.val,
            description: n.description,
            meta: n.meta,
          })
          // Fly camera toward the node
          const fg = fgRef.current
          if (fg && typeof n.x === "number") {
            const dist = 80
            const ratio = 1 + dist / Math.hypot(n.x, n.y!, n.z!)
            fg.cameraPosition(
              { x: n.x * ratio, y: n.y! * ratio, z: n.z! * ratio },
              { x: n.x, y: n.y!, z: n.z! },
              1000
            )
          }
        }}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  )
}

/** Renders a text label as a Three.js sprite (billboarded, always faces camera). */
function makeTextSprite(text: string, highlighted: boolean): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const fontSize = 48
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  const metrics = ctx.measureText(text)
  const padding = 16
  canvas.width = metrics.width + padding * 2
  canvas.height = fontSize + padding * 2

  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillStyle = highlighted ? "rgba(241,245,249,0.95)" : "rgba(148,163,184,0.35)"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  const scale = 0.16
  sprite.scale.set((canvas.width * scale) / 4, (canvas.height * scale) / 4, 1)
  return sprite
}
