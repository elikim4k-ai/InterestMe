"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Sparkles, Send, Loader2, Lightbulb } from "lucide-react"
import type { GraphInsights } from "@/lib/ai/insights"
import { askMyGraph } from "@/lib/actions/knowledge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function GraphInsightsPanel({ insights }: { insights: GraphInsights }) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  async function ask() {
    if (question.trim().length < 3) return
    setAsking(true)
    setAnswer(null)
    const result = await askMyGraph(question)
    setAsking(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setAnswer(result.data.answer)
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 px-5 py-3 border-b flex items-center gap-2">
        <Sparkles className="size-4 text-violet-500" />
        <h2 className="font-semibold text-sm">AI Insights</h2>
        {!insights.live && (
          <Badge variant="secondary" className="text-[10px] ml-auto">
            Offline mode
          </Badge>
        )}
      </div>
      <CardContent className="p-5 space-y-5">
        {/* Summary */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm leading-relaxed"
        >
          {insights.summary}
        </motion.p>

        {/* Suggestions */}
        <div className="space-y-2">
          {insights.suggestions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3"
            >
              <Lightbulb className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm">{s}</p>
            </motion.div>
          ))}
        </div>

        {/* Ask the graph */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Ask your graph</p>
          <div className="flex gap-2">
            <Input
              placeholder="Who should I learn from about AI?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
            />
            <Button size="icon" onClick={ask} disabled={asking}>
              {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {answer && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 text-sm"
            >
              {answer}
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
