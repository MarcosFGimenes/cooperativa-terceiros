export type DayPoint = { date: string; progress: number };

const clamp = (v:number,min=0,max=100)=>Math.min(max,Math.max(min,v));
const isoDate = (d:Date)=>d.toISOString().slice(0,10);

function lastKnown(series: DayPoint[], date: string) {
  let last = 0;
  for (const p of series) {
    if (p.date > date) break;
    last = p.progress;
  }
  return last;
}

export function buildServiceSeries(
  startedAt: Date,
  lastDate: Date,
  updates: { createdAt: Date; progress: number }[]
): DayPoint[] {
  const byDay = new Map<string, number>();
  let last = 0;
  const sorted = [...updates].sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime());
  sorted.forEach(u => {
    last = Math.max(last, clamp(u.progress, 0, 100));
    byDay.set(isoDate(u.createdAt), last);
  });

  const series: DayPoint[] = [];
  for (let d = new Date(startedAt); d <= lastDate; d.setDate(d.getDate()+1)) {
    const key = isoDate(d);
    if (byDay.has(key)) last = byDay.get(key)!;
    series.push({ date: key, progress: last });
  }
  return series;
}

export function aggregatePackageSeries(
  services: { totalHoursPlanned: number; series: DayPoint[] }[]
): DayPoint[] {
  const days = new Set<string>();
  services.forEach(s => s.series.forEach(p => days.add(p.date)));
  const sortedDays = [...days].sort();
  const denom = services.reduce((acc,s)=>acc + s.totalHoursPlanned, 0) || 1;

  return sortedDays.map(date => {
    const num = services.reduce((acc,s)=>{
      const p = s.series.find(x => x.date === date)?.progress ?? lastKnown(s.series, date);
      return acc + p * s.totalHoursPlanned;
    }, 0);
    return { date, progress: +(num/denom).toFixed(2) };
  });
}
