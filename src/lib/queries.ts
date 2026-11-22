import type { ExerciseEntry, WorkoutSession } from '../types';

/** 动作开始时间（毫秒）；旧数据用首组完成时间兜底，都没有则返回 null */
export function entryStartMs(entry: ExerciseEntry): number | null {
  const iso = entry.startedAt ?? entry.sets.find((set) => set.completedAt)?.completedAt;
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

/** 当天训练开始时间（旧数据用 createdAt 兜底） */
export function sessionStartIso(session: WorkoutSession): string {
  return session.startedAt ?? session.createdAt;
}

/**
 * 按当前排序模式排好的动作列表。
 * manual：按 order；time：按动作开始时间升序（没有时间的排最后）。
 */
export function orderEntries(session: WorkoutSession): ExerciseEntry[] {
  const list = [...session.exercises];
  if (session.sortMode !== 'time') {
    return list.sort((a, b) => a.order - b.order);
  }
  return list.sort((a, b) => {
    const aMs = entryStartMs(a);
    const bMs = entryStartMs(b);
    if (aMs === null && bMs === null) return a.order - b.order;
    if (aMs === null) return 1;
    if (bMs === null) return -1;
    if (aMs === bMs) return a.order - b.order;
    return aMs - bMs;
  });
}

export interface EntryRef {
  exerciseId?: string;
  name: string;
}

function matches(entry: ExerciseEntry, ref: EntryRef): boolean {
  if (ref.exerciseId && entry.exerciseId && ref.exerciseId === entry.exerciseId) return true;
  return entry.name === ref.name;
}

/** 动作在「本次输入记忆」中的 key：优先动作库 ID，其次名称 */
export function inputKey(ref: EntryRef): string {
  return ref.exerciseId ? `ex:${ref.exerciseId}` : `name:${ref.name}`;
}

/** 找出某动作在指定日期之前最近一次训练的明细（用于提示上次重量） */
export function findLastEntryBefore(
  sessions: WorkoutSession[],
  date: string,
  ref: EntryRef,
): { date: string; entry: ExerciseEntry } | null {
  const before = sessions
    .filter((s) => s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of before) {
    const entry = session.exercises.find((e) => matches(e, ref));
    if (entry && entry.sets.length > 0) return { date: session.date, entry };
  }
  return null;
}

/** 有序的历史日期列表（有动作或备注才算一天记录） */
export function recordedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.exercises.some((e) => e.sets.length > 0) || (s.note ?? '').trim() !== '')
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function sortByDateDesc(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date));
}

/** 动作按「收藏 -> 最近使用 -> 名称」排序 */
export function sortExercises<T extends { isFavorite: boolean; recentlyUsedAt?: string; name: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const aRecent = a.recentlyUsedAt ?? '';
    const bRecent = b.recentlyUsedAt ?? '';
    if (aRecent !== bRecent) return bRecent.localeCompare(aRecent);
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}
