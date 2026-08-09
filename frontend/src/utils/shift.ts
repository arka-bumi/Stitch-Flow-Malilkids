// Shift constants and helpers

export function isSaturday(dateISO: string): boolean {
  try {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d).getDay() === 6;
  } catch { return false; }
}

export function isSunday(dateISO: string): boolean {
  try {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
  } catch { return false; }
}

export function isWeekend(dateISO: string): boolean {
  return isSaturday(dateISO) || isSunday(dateISO);
}

export function shiftRange(dateISO: string): { start: string; end: string } {
  return isWeekend(dateISO) ? { start: "08:00", end: "15:00" } : { start: "08:15", end: "17:15" };
}

export function toMin(t?: string | null): number | null {
  if (!t || typeof t !== "string" || !t.includes(":")) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function fromMin(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${p(h)}:${p(mm)}`;
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}j ${mm}m` : `${mm}m`;
}

// Given sorted records by waktu_mulai, find gaps between records within shift
export function findGaps(records: any[]): { from: string; to: string }[] {
  const sorted = [...records].sort((a, b) => (toMin(a.waktu_mulai) || 0) - (toMin(b.waktu_mulai) || 0));
  const gaps: { from: string; to: string }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = toMin(sorted[i - 1].waktu_selesai);
    const curStart = toMin(sorted[i].waktu_mulai);
    if (prevEnd !== null && curStart !== null && curStart > prevEnd) {
      gaps.push({ from: sorted[i - 1].waktu_selesai, to: sorted[i].waktu_mulai });
    }
  }
  return gaps;
}

export function findGapAgainstPrevious(records: any[], newStart: string): { prevEnd: string; newStart: string } | null {
  if (!records.length) return null;
  const sorted = [...records].sort((a, b) => (toMin(a.waktu_selesai) || 0) - (toMin(b.waktu_selesai) || 0));
  const last = sorted[sorted.length - 1];
  const prevEnd = last.waktu_selesai;
  if (toMin(newStart)! > toMin(prevEnd)!) return { prevEnd, newStart };
  return null;
}

export function coverageCheck(records: any[], dateISO: string): {
  ok: boolean; continuousCoverage: boolean; gaps: { from: string; to: string }[]; needsIstirahat: boolean; outOfShift: boolean;
} {
  const { start, end } = shiftRange(dateISO);
  const sorted = [...records].sort((a, b) => (toMin(a.waktu_mulai) || 0) - (toMin(b.waktu_mulai) || 0));
  const shiftStart = toMin(start)!;
  const shiftEnd = toMin(end)!;
  const firstStart = sorted.length ? toMin(sorted[0].waktu_mulai) : null;
  const lastEnd = sorted.length ? toMin(sorted[sorted.length - 1].waktu_selesai) : null;
  const gaps = findGaps(sorted);
  const continuousCoverage =
    firstStart !== null && lastEnd !== null &&
    firstStart <= shiftStart && lastEnd >= shiftEnd && gaps.length === 0;
  const hasIstirahat = sorted.some((r) => r.type === "istirahat");
  const shortShift = isWeekend(dateISO);
  const needsIstirahat = !shortShift && !hasIstirahat;
  const outOfShift = sorted.some((r) => {
    const s = toMin(r.waktu_mulai), e = toMin(r.waktu_selesai);
    return (s !== null && s < shiftStart) || (e !== null && e > shiftEnd);
  });
  return { ok: continuousCoverage && !needsIstirahat, continuousCoverage, gaps, needsIstirahat, outOfShift };
}