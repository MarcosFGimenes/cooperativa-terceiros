export default function ServiceTimeline({ items }: {
  items: { date: string; progress: number; description?: string }[];
}) {
  return (
    <ul className="mt-4 space-y-3 max-h-72 overflow-auto pr-1">
      {items.map((it, i) => (
        <li key={i} className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{it.date}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{it.progress}%</span>
          </div>
          {it.description ? <p className="mt-2 text-sm text-muted-foreground">{it.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}
