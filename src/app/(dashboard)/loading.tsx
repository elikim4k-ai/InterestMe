/** Route-level loading skeleton shown while dashboard server components stream. */
export default function DashboardLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded-md bg-muted/70" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border bg-muted/40" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl border bg-muted/30" />
        ))}
      </div>
    </div>
  )
}
