/** 全部日期都基于本地时区，避免晚上训练被记到第二天 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

export function parseISO(iso: string): Date {
  const parts = iso.split('-').map((v) => Number(v));
  return new Date(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1, 0, 0, 0, 0);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseISO(value);
  return !isNaN(d.getTime()) && toLocalISO(d) === value;
}

export function addDays(iso: string, delta: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + delta);
  return toLocalISO(d);
}

export function weekdayLabel(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()] || '';
}

export function humanDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(iso)}`;
}

export function fullDateLabel(iso: string): string {
  const d = parseISO(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(iso)}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function relativeDayLabel(iso: string, today = todayISO()): string | null {
  const diff = daysBetween(today, iso);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === -2) return '前天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  return null;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function clockLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function clockLabelSec(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function durationLabel(ms: number): string | null {
  if (!isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '不到 1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}
