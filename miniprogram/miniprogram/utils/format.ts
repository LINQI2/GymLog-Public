import type { ExerciseEntry, SessionStats, SetEntry, WorkoutSession } from './types';

/** 去掉多余小数位：13.5 -> "13.5"，10 -> "10" */
export function num(value: number): string {
  if (!isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function setWeightLabel(weightKg: number): string {
  return weightKg === 0 ? '自重' : `${num(weightKg)} kg`;
}

export function volumeLabel(volume: number): string {
  if (volume <= 0) return '—';
  if (volume >= 10000) return `${(volume / 1000).toFixed(1)} t`;
  return `${Math.round(volume)} kg`;
}

export function entryStats(entry: ExerciseEntry) {
  let reps = 0;
  let volume = 0;
  for (const set of entry.sets) {
    reps += set.reps;
    if (set.weightKg > 0) volume += set.weightKg * set.reps;
  }
  return { setCount: entry.sets.length, reps, volume };
}

export function sessionStats(session: WorkoutSession | null): SessionStats {
  const stats: SessionStats = { exerciseCount: 0, setCount: 0, reps: 0, volume: 0 };
  if (!session) return stats;
  for (const entry of session.exercises) {
    const item = entryStats(entry);
    stats.exerciseCount += 1;
    stats.setCount += item.setCount;
    stats.reps += item.reps;
    stats.volume += item.volume;
  }
  return stats;
}

/** 相邻两组的实际间隔（依赖 completedAt） */
export function restGapLabel(current?: string, previous?: string): string | null {
  if (!current || !previous) return null;
  const from = Date.parse(previous);
  const to = Date.parse(current);
  if (!isFinite(from) || !isFinite(to) || to <= from) return null;
  const seconds = Math.round((to - from) / 1000);
  if (seconds < 60) return `间隔 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `间隔 ${hours} 时 ${minutes % 60} 分`;
  }
  return rest === 0 ? `间隔 ${minutes} 分` : `间隔 ${minutes} 分 ${rest} 秒`;
}

export function setsSummary(sets: SetEntry[]): string {
  return sets.map((set) => `${set.weightKg === 0 ? '自重' : num(set.weightKg)}×${set.reps}`).join('  ');
}
