import type { ServiceChecklistItem, ServiceUpdate } from "@/types";

export function daysBetween(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const ms = end.getTime() - start.getTime();
  const days = Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
  return { start, end, days };
}

export function plannedCurve(plannedStart: string, plannedEnd: string, totalHours: number) {
  const { start, days } = daysBetween(plannedStart, plannedEnd);
  const perDay = days > 0 ? totalHours / days : 0;
  const points: { date: string; percent: number; hoursAccum: number }[] = [];
  const safeTotal = totalHours > 0 ? totalHours : days * perDay || 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    const hoursAccum = perDay * (i + 1);
    const percent = Math.min(100, Math.round((hoursAccum / safeTotal) * 100));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    points.push({ date: `${year}-${month}-${day}`, percent, hoursAccum });
  }
  return points;
}

export function realizedFromChecklist(checklist: ServiceChecklistItem[] = []) {
  const total = checklist.reduce((acc, it) => acc + (it.progress ?? 0) * (it.weight / 100), 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function realizedFromUpdates(updates: ServiceUpdate[] = []) {
  if (!updates.length) return 0;
  const sorted = [...updates].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const last = sorted[sorted.length - 1];
  return Math.max(0, Math.min(100, Math.round(last.percent ?? 0)));
}
