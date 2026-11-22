import type { ExerciseEntry, WorkoutSession } from '../types';

/** 数字展示：去掉多余小数位（13.5 -> "13.5"，10 -> "10"） */
export function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** 重量展示，0 视为自重 */
export function weightLabel(weightKg: number): string {
  return weightKg === 0 ? '自重' : `${num(weightKg)} kg`;
}

/** 训练总量 = 重量 × 次数 之和；自重（0kg）不计入 */
export function volumeLabel(volume: number): string {
  if (volume <= 0) return '—';
  if (volume >= 10000) return `${(volume / 1000).toFixed(1)} t`;
  return `${Math.round(volume)} kg`;
}

export function groupLabel(index: number): string {
  return `第${index + 1}组`;
}

export interface EntryStats {
  setCount: number;
  reps: number;
  volume: number;
}

export function entryStats(entry: ExerciseEntry): EntryStats {
  let reps = 0;
  let volume = 0;
  for (const s of entry.sets) {
    reps += s.reps;
    if (s.weightKg > 0) volume += s.weightKg * s.reps;
  }
  return { setCount: entry.sets.length, reps, volume };
}

export interface SessionStats extends EntryStats {
  exerciseCount: number;
}

export function sessionStats(session: WorkoutSession): SessionStats {
  const stats: SessionStats = { exerciseCount: 0, setCount: 0, reps: 0, volume: 0 };
  for (const entry of session.exercises) {
    const s = entryStats(entry);
    stats.exerciseCount += 1;
    stats.setCount += s.setCount;
    stats.reps += s.reps;
    stats.volume += s.volume;
  }
  return stats;
}

/** 相邻两组的实际间隔（依赖 set.completedAt，旧数据没有记录时返回 null） */
export function restGapLabel(current?: string, previous?: string): string | null {
  if (!current || !previous) return null;
  const from = Date.parse(previous);
  const to = Date.parse(current);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  const totalSec = Math.round((to - from) / 1000);
  if (totalSec < 60) return `间隔 ${totalSec} 秒`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `间隔 ${hours} 时 ${restMinutes} 分`;
  }
  return seconds === 0 ? `间隔 ${minutes} 分` : `间隔 ${minutes} 分 ${seconds} 秒`;
}

/** 各组重量×次数 的紧凑展示，如 "10×13 10×13 13.5×12" */
export function setsSummary(entry: ExerciseEntry): string {
  return entry.sets
    .map((s) => `${s.weightKg === 0 ? '自重' : num(s.weightKg)}×${s.reps}`)
    .join('  ');
}
