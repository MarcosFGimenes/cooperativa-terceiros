export default function ServiceTimeline({ items }:{
  items: { date: string; progress: number; note?: string }[];
}) {
  return (
    <ul className="mt-2 space-y-1 max-h-64 overflow-auto pr-1">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">{it.date}</span> — {it.progress}% {it.note ? `— ${it.note}` : ""}
        </li>
      ))}
    </ul>
  );
}
