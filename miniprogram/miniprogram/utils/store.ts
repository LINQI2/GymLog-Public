/**
 * 业务数据层：动作库、训练记录、设置。
 * 所有数据同步写入微信 Storage，关闭小程序再打开不会丢失。
 */
import type {
  AppSettings,
  ExerciseCatalogItem,
  ExerciseCategory,
  ExerciseEntry,
  LastInput,
  SetEntry,
  WorkoutSession,
} from './types';
import { nowISO } from './date';
import { uid } from './id';
import { createDefaultExercises } from './defaults';
import { isSafeSet, normalizeName } from './validation';
import * as S from './storage';

export const META_LAST_INPUTS = 'lastInputs';
export const META_SETTINGS = 'settings';
export const META_SEEDED = 'seeded';

export const DEFAULT_SETTINGS: AppSettings = {
  restSeconds: 90,
  restAutoStart: true,
  restVibrate: true,
  restSound: false,
};

/* ==================== 设置 ==================== */

export function getSettings(): AppSettings {
  const stored = S.read<Partial<AppSettings>>(S.K.meta(META_SETTINGS), {});
  const seconds = Number(stored.restSeconds);
  return {
    restSeconds: isFinite(seconds) && seconds >= 5 && seconds <= 1800 ? Math.round(seconds) : 90,
    restAutoStart: stored.restAutoStart !== false,
    restVibrate: stored.restVibrate !== false,
    restSound: stored.restSound === true,
  };
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = { ...getSettings(), ...patch };
  next.restSeconds = Math.max(5, Math.min(1800, Math.round(next.restSeconds || 90)));
  S.write(S.K.meta(META_SETTINGS), next);
  return next;
}

/* ==================== 上一组记忆 ==================== */

export function inputKey(entry: { exerciseId?: string; name: string }): string {
  return entry.exerciseId ? `ex:${entry.exerciseId}` : `name:${entry.name}`;
}

export function getLastInputs(): Record<string, LastInput> {
  return S.read<Record<string, LastInput>>(S.K.meta(META_LAST_INPUTS), {});
}

export function rememberInput(key: string, weightKg: number, reps: number): void {
  const all = getLastInputs();
  all[key] = { weightKg, reps, updatedAt: nowISO() };
  S.write(S.K.meta(META_LAST_INPUTS), all);
}

/* ==================== 动作库 ==================== */

/** 首次启动写入内置动作 */
export function ensureSeed(): void {
  const index = S.readIndex(S.K.exerciseIndex);
  const seeded = S.read<boolean>(S.K.meta(META_SEEDED), false);
  if (index.length === 0) {
    const defaults = createDefaultExercises();
    defaults.forEach((item) => {
      S.write(S.K.exercise(item.id), item);
    });
    S.write(
      S.K.exerciseIndex,
      defaults.map((item) => item.id),
    );
  }
  if (!seeded) S.write(S.K.meta(META_SEEDED), true);
  if (!S.read<number>(S.K.schema, 0)) S.write(S.K.schema, S.SCHEMA_VERSION);
}

export function listExercises(): ExerciseCatalogItem[] {
  const ids = S.readIndex(S.K.exerciseIndex);
  const list: ExerciseCatalogItem[] = [];
  ids.forEach((id) => {
    const item = S.read<ExerciseCatalogItem | null>(S.K.exercise(id), null);
    if (item && item.id) list.push(item);
  });
  return list.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getExercise(id: string): ExerciseCatalogItem | null {
  return S.read<ExerciseCatalogItem | null>(S.K.exercise(id), null);
}

export function createExercise(name: string, category: ExerciseCategory): ExerciseCatalogItem {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('动作名称不能为空');
  const existing = listExercises().find((item) => item.name === normalized);
  if (existing) return existing;
  const item: ExerciseCatalogItem = {
    id: uid(),
    name: normalized,
    category,
    isFavorite: false,
    createdAt: nowISO(),
  };
  S.write(S.K.exercise(item.id), item);
  S.ensureInIndex(S.K.exerciseIndex, item.id);
  return item;
}

export function updateExercise(id: string, patch: Partial<Omit<ExerciseCatalogItem, 'id'>>): void {
  const target = getExercise(id);
  if (!target) return;
  const next: ExerciseCatalogItem = { ...target, ...patch };
  next.name = normalizeName(next.name) || target.name;
  S.write(S.K.exercise(id), next);
}

export function deleteExercise(id: string): void {
  // 只删动作库条目，历史记录里的名称快照不受影响
  S.remove(S.K.exercise(id));
  S.removeFromIndex(S.K.exerciseIndex, id);
}

export function touchExercise(id?: string): void {
  if (!id) return;
  const target = getExercise(id);
  if (!target) return;
  S.write(S.K.exercise(id), { ...target, recentlyUsedAt: nowISO() });
}

/* ==================== 训练记录 ==================== */

export function getSession(date: string): WorkoutSession | null {
  const session = S.read<WorkoutSession | null>(S.K.session(date), null);
  if (!session || !session.date) return null;
  if (!Array.isArray(session.exercises)) session.exercises = [];
  return session;
}

export function saveSession(session: WorkoutSession): boolean {
  const ok = S.write(S.K.session(session.date), session);
  if (ok) S.ensureInIndex(S.K.sessionIndex, session.date);
  return ok;
}

export function listSessionDates(): string[] {
  const index = S.readIndex(S.K.sessionIndex);
  const valid = index.filter((date) => Boolean(getSession(date)));
  return valid.sort((a, b) => (a < b ? 1 : -1));
}

export function listSessions(): WorkoutSession[] {
  return listSessionDates()
    .map((date) => getSession(date))
    .filter((session): session is WorkoutSession => Boolean(session));
}

export function deleteSession(date: string): void {
  S.remove(S.K.session(date));
  S.removeFromIndex(S.K.sessionIndex, date);
}

/** 当天备注（留空则删除该字段） */
export function setSessionNote(date: string, note: string): void {
  const session = getOrCreateSession(date);
  const trimmed = (note || '').trim();
  if (trimmed) session.note = trimmed;
  else delete session.note;
  session.updatedAt = nowISO();
  saveSession(session);
}

export function getOrCreateSession(date: string): WorkoutSession {
  const existing = getSession(date);
  if (existing) return existing;
  const ts = nowISO();
  const session: WorkoutSession = {
    id: uid(),
    date,
    exercises: [],
    createdAt: ts,
    updatedAt: ts,
    startedAt: ts,
  };
  saveSession(session);
  return session;
}

export interface EntryRef {
  exerciseId?: string;
  name: string;
  target?: ExerciseEntry['target'];
}

/** 添加动作卡片（不会自动生成已完成的组） */
export function addExerciseToSession(
  date: string,
  ref: EntryRef,
): { entryId: string; existed: boolean } {
  const session = getOrCreateSession(date);
  const existing = session.exercises.find(
    (entry) =>
      (ref.exerciseId && entry.exerciseId === ref.exerciseId) || entry.name === ref.name,
  );
  if (existing) {
    touchExercise(ref.exerciseId);
    return { entryId: existing.id, existed: true };
  }
  const entryId = uid();
  const entry: ExerciseEntry = {
    id: entryId,
    exerciseId: ref.exerciseId,
    name: ref.name,
    sets: [],
    order: session.exercises.length,
  };
  if (ref.target) entry.target = ref.target;
  session.exercises.push(entry);
  session.updatedAt = nowISO();
  saveSession(session);
  touchExercise(ref.exerciseId);
  return { entryId, existed: false };
}

/** 记录一组：默认沿用这一动作上一组的重量与次数 */
export function addSet(date: string, entryId: string): string | null {
  const session = getSession(date);
  if (!session) return null;
  const entry = session.exercises.find((item) => item.id === entryId);
  if (!entry) return null;

  const last = entry.sets[entry.sets.length - 1];
  const memory = getLastInputs()[inputKey(entry)];
  const weightKg = last ? last.weightKg : memory ? memory.weightKg : 0;
  const reps = last ? last.reps : memory ? memory.reps : 10;
  if (!isSafeSet(weightKg, reps)) return null;

  const setId = uid();
  const completedAt = nowISO();
  const firstSetToday = session.exercises.every((item) => item.sets.length === 0);

  session.exercises = session.exercises.map((item) =>
    item.id === entryId
      ? {
          ...item,
          startedAt: item.startedAt || completedAt,
          sets: [...item.sets, { id: setId, weightKg, reps, type: 'normal', completedAt }],
        }
      : item,
  );
  if (firstSetToday) session.startedAt = completedAt;
  session.updatedAt = nowISO();
  saveSession(session);
  rememberInput(inputKey(entry), weightKg, reps);
  return setId;
}

export function updateSet(
  date: string,
  entryId: string,
  setId: string,
  patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>,
): boolean {
  const session = getSession(date);
  if (!session) return false;
  const entry = session.exercises.find((item) => item.id === entryId);
  const target = entry && entry.sets.find((set) => set.id === setId);
  if (!entry || !target) return false;

  const weightKg = patch.weightKg !== undefined ? patch.weightKg : target.weightKg;
  const reps = patch.reps !== undefined ? patch.reps : target.reps;
  if (!isSafeSet(weightKg, reps)) return false;

  session.exercises = session.exercises.map((item) =>
    item.id === entryId
      ? {
          ...item,
          sets: item.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
        }
      : item,
  );
  session.updatedAt = nowISO();
  saveSession(session);

  const isLast = entry.sets[entry.sets.length - 1].id === setId;
  if (isLast) rememberInput(inputKey(entry), weightKg, reps);
  return true;
}

export function deleteSet(date: string, entryId: string, setId: string): void {
  const session = getSession(date);
  if (!session) return;
  session.exercises = session.exercises.map((item) =>
    item.id === entryId ? { ...item, sets: item.sets.filter((set) => set.id !== setId) } : item,
  );
  session.updatedAt = nowISO();
  saveSession(session);
}

export function deleteEntry(date: string, entryId: string): void {
  const session = getSession(date);
  if (!session) return;
  const remaining = session.exercises.filter((item) => item.id !== entryId);
  session.exercises = remaining.map((item, index) => ({ ...item, order: index }));
  session.updatedAt = nowISO();
  saveSession(session);
}

/**
 * 用替代动作替换当天卡片。
 * 只有在还没有任何组时才真正替换；已有完成组时返回 false，由调用方改为追加。
 */
export function replaceEntryExercise(
  date: string,
  entryId: string,
  ref: { exerciseId?: string; name: string },
): boolean {
  const session = getSession(date);
  if (!session) return false;
  const entry = session.exercises.find((item) => item.id === entryId);
  if (!entry) return false;
  if (entry.sets.length > 0) return false;
  session.exercises = session.exercises.map((item) =>
    item.id === entryId
      ? {
          ...item,
          ...(ref.exerciseId ? { exerciseId: ref.exerciseId } : {}),
          name: ref.name,
        }
      : item,
  );
  session.updatedAt = nowISO();
  saveSession(session);
  return true;
}

export function renameEntry(date: string, entryId: string, name: string): void {
  const trimmed = normalizeName(name);
  if (!trimmed) return;
  const session = getSession(date);
  if (!session) return;
  session.exercises = session.exercises.map((item) =>
    item.id === entryId ? { ...item, name: trimmed } : item,
  );
  session.updatedAt = nowISO();
  saveSession(session);
}

/** 某动作在指定日期之前最近一次的训练记录 */
export function lastEntryBefore(
  date: string,
  ref: { exerciseId?: string; name: string },
): { date: string; entry: ExerciseEntry } | null {
  const dates = listSessionDates().filter((item) => item < date);
  for (const item of dates) {
    const session = getSession(item);
    if (!session) continue;
    const entry = session.exercises.find(
      (candidate) =>
        (ref.exerciseId && candidate.exerciseId === ref.exerciseId) ||
        candidate.name === ref.name,
    );
    if (entry && entry.sets.length > 0) return { date: item, entry };
  }
  return null;
}

/** 动作在某天的卡片（用于“上次”提示与目标） */
export function findEntry(date: string, entryId: string): ExerciseEntry | null {
  const session = getSession(date);
  if (!session) return null;
  return session.exercises.find((item) => item.id === entryId) || null;
}
