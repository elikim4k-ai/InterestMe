"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import {
  NODE_COLORS,
  NODE_KIND_LABEL,
  type GraphNode,
} from "@/lib/knowledge/types"

export function NodeInspector({
  node,
  onClose,
  action,
}: {
  node: GraphNode | null
  onClose: () => void
  /** Optional context action rendered at the bottom (e.g. "Find" on Event Map). */
  action?: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="absolute top-4 right-4 z-20 w-72 rounded-2xl border bg-background/85 backdrop-blur-xl shadow-2xl p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: NODE_COLORS[node.kind] }}
              />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {NODE_KIND_LABEL[node.kind]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <h3 className="mt-2 text-lg font-bold leading-tight">{node.label}</h3>

          {node.description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{node.description}</p>
          )}

          {node.meta && Object.keys(node.meta).length > 0 && (
            <dl className="mt-4 space-y-1.5">
              {Object.entries(node.meta).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <dt className="text-muted-foreground capitalize">{k}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}

          {action && <div className="mt-4">{action}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
