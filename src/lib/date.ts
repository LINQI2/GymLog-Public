/**
 * 全部日期处理都基于「本地时区」的 YYYY-MM-DD 字符串，绝不使用 toISOString()，
 * 避免晚上训练被记录成第二天。
 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 生成今天的本地日期字符串 */
export function todayISO(): string {
  return toLocalISO(new Date());
}

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 解析 YYYY-MM-DD 为本地零点时间 */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map((v) => Number(v));
  return new Date(y || 1970, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && toLocalISO(d) === value;
}

export function addDays(iso: string, delta: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + delta);
  return toLocalISO(d);
}

export function weekdayLabel(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()] ?? '';
}

export function monthDayLabel(iso: string): string {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fullDateLabel(iso: string): string {
  const d = parseISO(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 今天 / 昨天 / 前天 / 明天 / 后天，其他返回 null */
export function relativeDayLabel(iso: string, today = todayISO()): string | null {
  // daysBetween(today, iso) = iso - today，过去为负数
  const diff = daysBetween(today, iso);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === -2) return '前天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  return null;
}

/** b - a 的天数差（按本地零点计算） */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** 例：10月15日 周三 */
export function humanDate(iso: string): string {
  return `${monthDayLabel(iso)} ${weekdayLabel(iso)}`;
}

/** 例：2026年10月15日 周三 */
export function humanDateFull(iso: string): string {
  return `${fullDateLabel(iso)} ${weekdayLabel(iso)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** ISO 时间 -> 本地 HH:MM；无效或缺失返回 null */
export function clockLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ISO 时间 -> 本地 HH:MM:SS */
export function clockLabelSec(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 时长文案：75 分钟 -> "1 小时 15 分" */
export function durationLabel(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return '不到 1 分钟';
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分`;
}
