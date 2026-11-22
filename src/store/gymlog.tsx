import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  bulkWrite,
  clearAllData,
  loadAll,
  putArticle,
  putExercise,
  putMeta,
  putSession,
  putSubstitution,
  putTemplate,
  readMeta,
  removeArticle as dbRemoveArticle,
  removeExercise as dbRemoveExercise,
  removeSession as dbRemoveSession,
  removeSubstitution as dbRemoveSubstitution,
  removeTemplate as dbRemoveTemplate,
  requestPersistentStorage,
} from '../db';
import { createDefaultExercises } from '../lib/defaults';
import {
  buildSeedArticles,
  buildSeedSubstitutions,
  buildSeedTemplates,
  createSeedExtraExercises,
} from '../lib/knowledgeSeed';
import { nowISO, todayISO } from '../lib/date';
import { uid } from '../lib/id';
import {
  findLastEntryBefore,
  inputKey,
  orderEntries,
  sortByDateDesc,
  type EntryRef,
} from '../lib/queries';
import { isSafeSet, normalizeName } from '../lib/validation';
import { sanitizeDescription, sanitizeLinks } from '../lib/links';
import type {
  AppSettings,
  ArticleCategory,
  EntrySortMode,
  EntryTarget,
  ExerciseCatalogItem,
  ExerciseCategory,
  ExerciseEntry,
  ExerciseLink,
  ExerciseSubstitution,
  KnowledgeArticle,
  LastInput,
  SetEntry,
  SubstitutionSimilarity,
  TemplateExercise,
  TrainingTemplate,
  WorkoutSession,
} from '../types';
import type { ParsedBackup } from '../lib/backup';

const META_LAST_INPUTS = 'lastInputs';
const META_UNDO = 'undo';
const META_SETTINGS = 'settings';
const META_SEEDED = 'seeded';
const META_KNOWLEDGE_SEEDED = 'knowledgeSeeded';

export const REST_SECONDS_DEFAULT = 90;
export const REST_SECONDS_MIN = 10;
export const REST_SECONDS_MAX = 1800;

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  restSeconds: REST_SECONDS_DEFAULT,
  restAutoStart: true,
  restVibrate: true,
  restSound: true,
};
const DEFAULT_REPS = 10;

/** 旧版本设置/旧动作缺少新字段时补默认值；同时把时长限制在合理范围内 */
function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value ?? {}) };
  const seconds = Number(merged.restSeconds);
  merged.restSeconds = Number.isFinite(seconds)
    ? Math.min(REST_SECONDS_MAX, Math.max(REST_SECONDS_MIN, Math.round(seconds)))
    : REST_SECONDS_DEFAULT;
  merged.restAutoStart = merged.restAutoStart !== false;
  merged.restVibrate = merged.restVibrate !== false;
  merged.restSound = merged.restSound !== false;
  return merged;
}

/**
 * 兼容 v1 数据：旧动作没有 description / links 字段，
 * 读入时按空处理；脏数据（例如 javascript: 链接）在这里被过滤掉。
 */
function normalizeCatalogItem(item: ExerciseCatalogItem): ExerciseCatalogItem {
  const description = sanitizeDescription(item.description);
  const links = sanitizeLinks(item.links);
  const sameDescription = (description ?? undefined) === (item.description ?? undefined);
  const sameLinks = links.length === (item.links?.length ?? 0);
  if (sameDescription && sameLinks) return item;
  const next: ExerciseCatalogItem = { ...item };
  if (description) next.description = description;
  else delete next.description;
  if (links.length) next.links = links;
  else delete next.links;
  return next;
}

export interface TemplateInput {
  name: string;
  targetMuscles: string;
  description?: string;
  exercises: TemplateExercise[];
  isFavorite?: boolean;
  builtin?: boolean;
}

export interface ArticleInput {
  title: string;
  category: ArticleCategory;
  body: string;
  link?: ExerciseLink;
  exerciseIds?: string[];
  isFavorite?: boolean;
  needsReview?: boolean;
}

export interface SubstitutionInput {
  fromExerciseId: string;
  toExerciseId: string;
  similarity: SubstitutionSimilarity;
  difference: string;
  primaryMuscles?: string[];
  movementPattern?: string;
  equipment?: string;
  caution?: string;
}

export interface GymLogContextValue {
  ready: boolean;
  storageError: string | null;
  sessions: WorkoutSession[];
  exercises: ExerciseCatalogItem[];
  templates: TrainingTemplate[];
  articles: KnowledgeArticle[];
  substitutions: ExerciseSubstitution[];
  lastInputs: Record<string, LastInput>;
  settings: AppSettings;
  getSession: (date: string) => WorkoutSession | undefined;
  lastEntryBefore: (date: string, ref: EntryRef) => { date: string; entry: ExerciseEntry } | null;
  addExerciseToSession: (
    date: string,
    ref: { exerciseId?: string; name: string; target?: EntryTarget },
  ) => Promise<{ entryId: string; existed: boolean }>;
  addSet: (date: string, entryId: string) => Promise<string | null>;
  updateSet: (
    date: string,
    entryId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>,
  ) => Promise<void>;
  deleteSet: (date: string, entryId: string, setId: string) => Promise<void>;
  deleteEntry: (date: string, entryId: string) => Promise<void>;
  renameEntry: (date: string, entryId: string, name: string) => Promise<void>;
  /** 用替代动作替换当天卡片（只有还没有任何组时才会真正替换） */
  replaceEntryExercise: (
    date: string,
    entryId: string,
    ref: { exerciseId?: string; name: string },
  ) => Promise<void>;
  /** 手动上移/下移动作（-1 上移，1 下移），会自动切回手动排序 */
  moveEntry: (date: string, entryId: string, delta: -1 | 1) => Promise<void>;
  /** 切换排序方式：手动 / 按动作开始时间 */
  setSortMode: (date: string, mode: EntrySortMode) => Promise<void>;
  setNote: (date: string, note: string) => Promise<void>;
  /** 把当天的训练开始时间重置为现在（只影响「已练时长」，不动任何组记录） */
  resetSessionStart: (date: string) => Promise<void>;
  deleteSession: (date: string) => Promise<void>;
  undoLastAdd: (date: string) => Promise<boolean>;
  createExercise: (name: string, category: ExerciseCategory) => Promise<ExerciseCatalogItem>;
  updateExercise: (id: string, patch: Partial<Omit<ExerciseCatalogItem, 'id'>>) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  importData: (parsed: ParsedBackup, mode: 'merge' | 'replace') => Promise<void>;
  clearAll: () => Promise<void>;
  setTheme: (theme: AppSettings['theme']) => Promise<void>;
  /** 局部更新设置（休息计时等），未传的字段保持原值 */
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  restoreDefaults: () => Promise<void>;

  /* ---------- 训练模板 ---------- */
  createTemplate: (input: TemplateInput) => Promise<TrainingTemplate>;
  updateTemplate: (
    id: string,
    patch: Partial<Omit<TrainingTemplate, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<TrainingTemplate | null>;

  /* ---------- 知识文章 ---------- */
  createArticle: (input: ArticleInput) => Promise<KnowledgeArticle>;
  updateArticle: (
    id: string,
    patch: Partial<Omit<KnowledgeArticle, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;

  /* ---------- 动作替代 ---------- */
  createSubstitution: (input: SubstitutionInput) => Promise<ExerciseSubstitution | null>;
  deleteSubstitution: (id: string) => Promise<void>;
}

const GymLogContext = createContext<GymLogContextValue | null>(null);

/** 把内存里的动作列表按「当前显示顺序」固化成 order，避免切换排序模式时跳变 */
function withSequentialOrder(entries: ExerciseEntry[]): ExerciseEntry[] {
  return entries.map((entry, index) => ({ ...entry, order: index }));
}

/** 模板动作入库前的清洗：组数/次数范围限制在合理区间，旧备份缺字段时给默认值 */
function normalizeTemplateExercise(item: TemplateExercise): TemplateExercise {
  const sets = Math.min(20, Math.max(1, Math.round(Number(item.sets) || 3)));
  const repMin = Math.min(999, Math.max(1, Math.round(Number(item.repMin) || 8)));
  const repMax = Math.min(999, Math.max(repMin, Math.round(Number(item.repMax) || repMin)));
  const rest = Number(item.restSeconds);
  return {
    id: item.id || uid(),
    ...(item.exerciseId ? { exerciseId: item.exerciseId } : {}),
    name: normalizeName(item.name) || '未命名动作',
    sets,
    repMin,
    repMax,
    ...(Number.isFinite(rest) && rest > 0 ? { restSeconds: Math.round(rest) } : {}),
    ...(item.link?.url ? { link: item.link } : {}),
    ...(item.note?.trim() ? { note: item.note.trim() } : {}),
  };
}

export function GymLogProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [substitutions, setSubstitutions] = useState<ExerciseSubstitution[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [lastInputs, setLastInputs] = useState<Record<string, LastInput>>({});
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const sessionsRef = useRef<WorkoutSession[]>([]);
  const exercisesRef = useRef<ExerciseCatalogItem[]>([]);
  const templatesRef = useRef<TrainingTemplate[]>([]);
  const articlesRef = useRef<KnowledgeArticle[]>([]);
  const substitutionsRef = useRef<ExerciseSubstitution[]>([]);
  const lastInputsRef = useRef<Record<string, LastInput>>({});
  const undoRef = useRef<Record<string, { entryId: string; setId: string }>>({});
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  const applySessions = useCallback((next: WorkoutSession[]) => {
    const sorted = sortByDateDesc(next);
    sessionsRef.current = sorted;
    setSessions(sorted);
  }, []);

  const applyExercises = useCallback((next: ExerciseCatalogItem[]) => {
    const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    exercisesRef.current = sorted;
    setExercises(sorted);
  }, []);

  const applyTemplates = useCallback((next: TrainingTemplate[]) => {
    const sorted = [...next].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    });
    templatesRef.current = sorted;
    setTemplates(sorted);
  }, []);

  const applyArticles = useCallback((next: KnowledgeArticle[]) => {
    const sorted = [...next].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    articlesRef.current = sorted;
    setArticles(sorted);
  }, []);

  const applySubstitutions = useCallback((next: ExerciseSubstitution[]) => {
    const sorted = [...next].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    substitutionsRef.current = sorted;
    setSubstitutions(sorted);
  }, []);

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadAll();
        const storedSettings = (await readMeta<Partial<AppSettings>>(META_SETTINGS)) ?? DEFAULT_SETTINGS;
        const lastInputs = (await readMeta<Record<string, LastInput>>(META_LAST_INPUTS)) ?? {};
        const undo = (await readMeta<Record<string, { entryId: string; setId: string }>>(META_UNDO)) ?? {};
        const seeded = (await readMeta<boolean>(META_SEEDED)) ?? false;
        const knowledgeSeeded = (await readMeta<boolean>(META_KNOWLEDGE_SEEDED)) ?? false;
        if (cancelled) return;

        lastInputsRef.current = lastInputs;
        undoRef.current = undo;
        setLastInputs(lastInputs);
        const normalizedSettings = normalizeSettings(storedSettings);
        settingsRef.current = normalizedSettings;
        setSettings(normalizedSettings);

        let catalog = snapshot.exercises.map(normalizeCatalogItem);
        if (!seeded && catalog.length === 0) {
          catalog = createDefaultExercises();
          await bulkWrite({ exercises: catalog });
          await putMeta(META_SEEDED, true);
        }

        /**
         * 知识库首次初始化：补齐模板/替代关系会用到的动作，
         * 再写入示例模板、文章与替代关系。旧数据（sessions/exercises）不受影响。
         * 用户删光模板或文章后不会被重建（knowledgeSeeded 标记已存在）。
         */
        let templates = snapshot.templates;
        let articles = snapshot.articles;
        let substitutions = snapshot.substitutions;
        if (!knowledgeSeeded) {
          const extraExercises = createSeedExtraExercises(new Set(catalog.map((item) => item.name)));
          if (extraExercises.length) {
            catalog = [...catalog, ...extraExercises];
            await bulkWrite({ exercises: extraExercises });
          }
          if (templates.length === 0) {
            templates = buildSeedTemplates(catalog);
            await bulkWrite({ templates });
          }
          if (articles.length === 0) {
            articles = buildSeedArticles(catalog);
            await bulkWrite({ articles });
          }
          if (substitutions.length === 0) {
            substitutions = buildSeedSubstitutions(catalog);
            if (substitutions.length) await bulkWrite({ substitutions });
          }
          await putMeta(META_KNOWLEDGE_SEEDED, true);
        }

        applySessions(snapshot.sessions);
        applyExercises(catalog);
        applyTemplates(templates);
        applyArticles(articles);
        applySubstitutions(substitutions);
        setReady(true);
        void requestPersistentStorage();
      } catch (error) {
        if (cancelled) return;
        setStorageError(
          error instanceof Error ? error.message : '无法打开本地数据库，记录可能无法保存。',
        );
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyArticles, applyExercises, applySessions, applySubstitutions, applyTemplates]);

  /* ---------- 主题 ---------- */
  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mql.matches);
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0b0e13' : '#f4f5f7');
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [settings.theme]);

  /* ---------- 内部工具 ---------- */
  const mutateSession = useCallback(
    async (date: string, fn: (session: WorkoutSession) => WorkoutSession) => {
      const current = sessionsRef.current.find((s) => s.date === date);
      const ts = nowISO();
      const base: WorkoutSession =
        current ?? { id: uid(), date, exercises: [], createdAt: ts, updatedAt: ts, startedAt: ts };
      const updated: WorkoutSession = { ...fn(base), updatedAt: nowISO() };
      applySessions([...sessionsRef.current.filter((s) => s.date !== date), updated]);
      await putSession(updated);
      return updated;
    },
    [applySessions],
  );

  const persistUndo = useCallback(async () => {
    await putMeta(META_UNDO, undoRef.current);
  }, []);

  const rememberInput = useCallback(async (key: string, weightKg: number, reps: number) => {
    const next = {
      ...lastInputsRef.current,
      [key]: { weightKg, reps, updatedAt: nowISO() },
    };
    lastInputsRef.current = next;
    setLastInputs(next);
    await putMeta(META_LAST_INPUTS, next);
  }, []);

  const touchExercise = useCallback(
    (exerciseId?: string) => {
      if (!exerciseId) return;
      const target = exercisesRef.current.find((e) => e.id === exerciseId);
      if (!target) return;
      const updated = { ...target, recentlyUsedAt: nowISO() };
      applyExercises(exercisesRef.current.map((e) => (e.id === exerciseId ? updated : e)));
      void putExercise(updated);
    },
    [applyExercises],
  );

  /* ---------- 对外操作 ---------- */
  const getSession = useCallback(
    (date: string) => sessionsRef.current.find((s) => s.date === date),
    [],
  );

  const lastEntryBefore = useCallback(
    (date: string, ref: EntryRef) => findLastEntryBefore(sessionsRef.current, date, ref),
    [],
  );

  const addExerciseToSession = useCallback(
    async (date: string, ref: { exerciseId?: string; name: string; target?: EntryTarget }) => {
      const current = sessionsRef.current.find((s) => s.date === date);
      const existing = current?.exercises.find(
        (e) => (ref.exerciseId && e.exerciseId === ref.exerciseId) || e.name === ref.name,
      );
      if (existing) {
        touchExercise(ref.exerciseId);
        return { entryId: existing.id, existed: true };
      }
      const entryId = uid();
      await mutateSession(date, (session) => ({
        ...session,
        exercises: [
          ...session.exercises,
          {
            id: entryId,
            exerciseId: ref.exerciseId,
            name: ref.name,
            sets: [],
            order: session.exercises.length,
            ...(ref.target ? { target: ref.target } : {}),
          },
        ],
      }));
      touchExercise(ref.exerciseId);
      return { entryId, existed: false };
    },
    [mutateSession, touchExercise],
  );

  const addSet = useCallback(
    async (date: string, entryId: string) => {
      const session = sessionsRef.current.find((s) => s.date === date);
      const entry = session?.exercises.find((e) => e.id === entryId);
      if (!entry) return null;

      const last = entry.sets[entry.sets.length - 1];
      const memory = lastInputsRef.current[inputKey(entry)];
      const weightKg = last?.weightKg ?? memory?.weightKg ?? 0;
      const reps = last?.reps ?? memory?.reps ?? DEFAULT_REPS;
      if (!isSafeSet(weightKg, reps)) return null;

      const setId = uid();
      const completedAt = nowISO();
      await mutateSession(date, (s) => {
        // 当天第一组真正记录时才算「开始训练」，只添加动作不算
        const isFirstSetToday = s.exercises.every((e) => e.sets.length === 0);
        return {
          ...s,
          ...(isFirstSetToday ? { startedAt: completedAt } : {}),
          exercises: s.exercises.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  // 这个动作的第一次记录时间（旧数据没有时补齐）
                  startedAt: e.startedAt ?? completedAt,
                  sets: [...e.sets, { id: setId, weightKg, reps, type: 'normal', completedAt }],
                }
              : e,
          ),
        };
      });
      undoRef.current = { ...undoRef.current, [date]: { entryId, setId } };
      void persistUndo();
      void rememberInput(inputKey(entry), weightKg, reps);
      return setId;
    },
    [mutateSession, persistUndo, rememberInput],
  );

  const updateSet = useCallback<GymLogContextValue['updateSet']>(
    async (date, entryId, setId, patch) => {
      const session = sessionsRef.current.find((s) => s.date === date);
      const entry = session?.exercises.find((e) => e.id === entryId);
      const target = entry?.sets.find((s) => s.id === setId);
      if (!entry || !target) return;

      const weightKg = patch.weightKg ?? target.weightKg;
      const reps = patch.reps ?? target.reps;
      if (!isSafeSet(weightKg, reps)) return;

      await mutateSession(date, (s) => ({
        ...s,
        exercises: s.exercises.map((e) =>
          e.id === entryId
            ? {
                ...e,
                sets: e.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
              }
            : e,
        ),
      }));

      // 只记忆「最后一组」，避免修改旧组时污染默认值
      if (entry.sets[entry.sets.length - 1]?.id === setId) {
        void rememberInput(inputKey(entry), weightKg, reps);
      }
    },
    [mutateSession, rememberInput],
  );

  const deleteSet = useCallback(
    async (date: string, entryId: string, setId: string) => {
      await mutateSession(date, (s) => ({
        ...s,
        exercises: s.exercises.map((e) =>
          e.id === entryId ? { ...e, sets: e.sets.filter((set) => set.id !== setId) } : e,
        ),
      }));
      if (undoRef.current[date]?.setId === setId) {
        const next = { ...undoRef.current };
        delete next[date];
        undoRef.current = next;
        void persistUndo();
      }
    },
    [mutateSession, persistUndo],
  );

  const deleteEntry = useCallback(
    async (date: string, entryId: string) => {
      await mutateSession(date, (s) => {
        const remaining = s.exercises.filter((e) => e.id !== entryId);
        return { ...s, exercises: remaining.map((e, index) => ({ ...e, order: index })) };
      });
      if (undoRef.current[date]?.entryId === entryId) {
        const next = { ...undoRef.current };
        delete next[date];
        undoRef.current = next;
        void persistUndo();
      }
    },
    [mutateSession, persistUndo],
  );

  const renameEntry = useCallback(
    async (date: string, entryId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await mutateSession(date, (s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === entryId ? { ...e, name: trimmed } : e)),
      }));
    },
    [mutateSession],
  );

  const replaceEntryExercise = useCallback<GymLogContextValue['replaceEntryExercise']>(
    async (date, entryId, ref) => {
      await mutateSession(date, (session) => ({
        ...session,
        exercises: session.exercises.map((entry) => {
          if (entry.id !== entryId) return entry;
          // 双重保护：已经有组就不动，避免改写已完成的数据
          if (entry.sets.length > 0) return entry;
          return {
            ...entry,
            ...(ref.exerciseId ? { exerciseId: ref.exerciseId } : {}),
            name: ref.name,
          };
        }),
      }));
    },
    [mutateSession],
  );

  const moveEntry = useCallback(
    async (date: string, entryId: string, delta: -1 | 1) => {
      await mutateSession(date, (session) => {
        const ordered = orderEntries(session);
        const index = ordered.findIndex((entry) => entry.id === entryId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= ordered.length) return session;
        const next = [...ordered];
        [next[index], next[target]] = [next[target], next[index]];
        // 手动移动即视为切换到手动排序
        return { ...session, sortMode: 'manual', exercises: withSequentialOrder(next) };
      });
    },
    [mutateSession],
  );

  const setSortMode = useCallback<GymLogContextValue['setSortMode']>(
    async (date, mode) => {
      await mutateSession(date, (session) => {
        if (mode === 'manual') {
          // 切回手动时把当前看到的顺序固化，避免顺序突然跳变
          return {
            ...session,
            sortMode: 'manual',
            exercises: withSequentialOrder(orderEntries(session)),
          };
        }
        return { ...session, sortMode: 'time' };
      });
    },
    [mutateSession],
  );

  const setNote = useCallback(
    async (date: string, note: string) => {
      await mutateSession(date, (s) => ({ ...s, note: note.trim() ? note : undefined }));
    },
    [mutateSession],
  );

  const resetSessionStart = useCallback(
    async (date: string) => {
      const session = sessionsRef.current.find((s) => s.date === date);
      if (!session) return;
      await mutateSession(date, (s) => ({ ...s, startedAt: nowISO() }));
    },
    [mutateSession],
  );

  const deleteSession = useCallback(
    async (date: string) => {
      const session = sessionsRef.current.find((s) => s.date === date);
      applySessions(sessionsRef.current.filter((s) => s.date !== date));
      if (session) await dbRemoveSession(session.id);
      if (undoRef.current[date]) {
        const next = { ...undoRef.current };
        delete next[date];
        undoRef.current = next;
        void persistUndo();
      }
    },
    [applySessions, persistUndo],
  );

  const undoLastAdd = useCallback(
    async (date: string) => {
      const record = undoRef.current[date];
      if (!record) return false;
      const session = sessionsRef.current.find((s) => s.date === date);
      const entry = session?.exercises.find((e) => e.id === record.entryId);
      if (!entry || !entry.sets.some((s) => s.id === record.setId)) {
        const next = { ...undoRef.current };
        delete next[date];
        undoRef.current = next;
        void persistUndo();
        return false;
      }
      await deleteSet(date, record.entryId, record.setId);
      return true;
    },
    [deleteSet, persistUndo],
  );

  const createExercise = useCallback(
    async (name: string, category: ExerciseCategory) => {
      const normalized = normalizeName(name);
      if (!normalized) throw new Error('动作名称不能为空');
      const existing = exercisesRef.current.find((e) => e.name === normalized);
      if (existing) return existing;
      const item: ExerciseCatalogItem = {
        id: uid(),
        name: normalized,
        category,
        isFavorite: false,
        createdAt: nowISO(),
      };
      applyExercises([...exercisesRef.current, item]);
      await putExercise(item);
      return item;
    },
    [applyExercises],
  );

  const updateExercise = useCallback<GymLogContextValue['updateExercise']>(
    async (id, patch) => {
      const target = exercisesRef.current.find((e) => e.id === id);
      if (!target) return;
      const updated = { ...target, ...patch };
      updated.name = normalizeName(updated.name) || target.name;
      // 简介与链接来自用户输入，写入前统一清洗（拒绝 javascript: 等协议）
      if ('description' in patch) {
        const description = sanitizeDescription(patch.description);
        if (description) updated.description = description;
        else delete updated.description;
      }
      if ('links' in patch) {
        const links = sanitizeLinks(patch.links);
        if (links.length) updated.links = links;
        else delete updated.links;
      }
      applyExercises(exercisesRef.current.map((e) => (e.id === id ? updated : e)));
      await putExercise(updated);
    },
    [applyExercises],
  );

  const deleteExercise = useCallback(
    async (id: string) => {
      // 只删除动作库条目，历史记录中的名称快照保持完整
      applyExercises(exercisesRef.current.filter((e) => e.id !== id));
      await dbRemoveExercise(id);
    },
    [applyExercises],
  );

  const importData = useCallback<GymLogContextValue['importData']>(
    async (parsed, mode) => {
      if (mode === 'replace') {
        const incomingExercises = (parsed.exercises.length ? parsed.exercises : createDefaultExercises()).map(
          normalizeCatalogItem,
        );
        // 旧版备份（v1/v2）没有知识库数据，用内置示例兜底，避免覆盖导入后栏目全空
        const incomingTemplates = parsed.templates.length
          ? parsed.templates
          : buildSeedTemplates(incomingExercises);
        const incomingArticles = parsed.articles.length
          ? parsed.articles
          : buildSeedArticles(incomingExercises);
        const incomingSubstitutions = parsed.substitutions.length
          ? parsed.substitutions
          : buildSeedSubstitutions(incomingExercises);

        await clearAllData();
        await bulkWrite({
          sessions: parsed.sessions,
          exercises: incomingExercises,
          templates: incomingTemplates,
          articles: incomingArticles,
          substitutions: incomingSubstitutions,
          meta: [
            { key: META_SETTINGS, value: settingsRef.current },
            { key: META_SEEDED, value: true },
            { key: META_KNOWLEDGE_SEEDED, value: true },
          ],
        });
        const lastInputs = parsed.lastInputs ?? {};
        await putMeta(META_LAST_INPUTS, lastInputs);
        lastInputsRef.current = lastInputs;
        setLastInputs(lastInputs);
        undoRef.current = {};
        applySessions(parsed.sessions);
        applyExercises(incomingExercises);
        applyTemplates(incomingTemplates);
        applyArticles(incomingArticles);
        applySubstitutions(incomingSubstitutions);
        return;
      }

      // 合并：按日期合并同一天，动作库保留本地优先
      const byDate = new Map(sessionsRef.current.map((s) => [s.date, s]));
      for (const incoming of parsed.sessions) {
        const existing = byDate.get(incoming.date);
        if (!existing) {
          byDate.set(incoming.date, incoming);
          continue;
        }
        const entries = [...existing.exercises];
        for (const inc of incoming.exercises) {
          const index = entries.findIndex(
            (e) => e.id === inc.id || e.name === inc.name || (!!e.exerciseId && e.exerciseId === inc.exerciseId),
          );
          if (index >= 0) {
            const target = entries[index];
            const known = new Set(target.sets.map((s) => s.id));
            entries[index] = {
              ...target,
              sets: [...target.sets, ...inc.sets.filter((s) => !known.has(s.id))],
            };
          } else {
            entries.push({ ...inc, order: entries.length });
          }
        }
        byDate.set(incoming.date, {
          ...existing,
          exercises: entries.map((e, i) => ({ ...e, order: i })),
          updatedAt: nowISO(),
        });
      }

      const nextSessions = sortByDateDesc([...byDate.values()]);
      const mergedExercises = exercisesRef.current.map((item) => ({ ...item }));
      const byId = new Map(mergedExercises.map((item) => [item.id, item]));
      const byName = new Map(mergedExercises.map((item) => [item.name, item]));
      for (const item of parsed.exercises) {
        const normalized = normalizeCatalogItem(item);
        const existing = byId.get(normalized.id) ?? byName.get(normalized.name);
        if (!existing) {
          mergedExercises.push(normalized);
          byId.set(normalized.id, normalized);
          byName.set(normalized.name, normalized);
          continue;
        }
        // 同一条动作：本机内容优先，只在本地还没有学习资料时用备份补齐
        const description = existing.description || normalized.description;
        const links = existing.links?.length ? existing.links : normalized.links;
        if (description !== existing.description || links !== existing.links) {
          if (description) existing.description = description;
          else delete existing.description;
          if (links?.length) existing.links = links;
          else delete existing.links;
        }
      }
      const mergedLastInputs = { ...(parsed.lastInputs ?? {}), ...lastInputsRef.current };

      // 知识库按 ID 去重，本机已有内容优先，不覆盖用户编辑过的版本
      const mergedTemplates = templatesRef.current.map((item) => ({ ...item }));
      const templateIds = new Set(mergedTemplates.map((item) => item.id));
      for (const item of parsed.templates) {
        if (templateIds.has(item.id)) continue;
        mergedTemplates.push(item);
        templateIds.add(item.id);
      }

      const mergedArticles = articlesRef.current.map((item) => ({ ...item }));
      const articleIds = new Set(mergedArticles.map((item) => item.id));
      for (const item of parsed.articles) {
        if (articleIds.has(item.id)) continue;
        mergedArticles.push(item);
        articleIds.add(item.id);
      }

      const mergedSubstitutions = substitutionsRef.current.map((item) => ({ ...item }));
      const subKeys = new Set(
        mergedSubstitutions.map((item) => `${item.fromExerciseId}>${item.toExerciseId}`),
      );
      for (const item of parsed.substitutions) {
        const key = `${item.fromExerciseId}>${item.toExerciseId}`;
        if (subKeys.has(key)) continue;
        mergedSubstitutions.push(item);
        subKeys.add(key);
      }

      await bulkWrite({
        sessions: nextSessions,
        exercises: mergedExercises,
        templates: mergedTemplates,
        articles: mergedArticles,
        substitutions: mergedSubstitutions,
        meta: [
          { key: META_LAST_INPUTS, value: mergedLastInputs },
          { key: META_SEEDED, value: true },
          { key: META_KNOWLEDGE_SEEDED, value: true },
        ],
      });
      lastInputsRef.current = mergedLastInputs;
      setLastInputs(mergedLastInputs);
      applySessions(nextSessions);
      applyExercises(mergedExercises);
      applyTemplates(mergedTemplates);
      applyArticles(mergedArticles);
      applySubstitutions(mergedSubstitutions);
    },
    [applyArticles, applyExercises, applySessions, applySubstitutions, applyTemplates, settings],
  );

  const clearAll = useCallback(async () => {
    await clearAllData();
    sessionsRef.current = [];
    lastInputsRef.current = {};
    setLastInputs({});
    undoRef.current = {};
    setSessions([]);
    applyExercises([]);
    applyTemplates([]);
    applyArticles([]);
    applySubstitutions([]);
    await putMeta(META_SEEDED, true);
    // 用户主动清空后，不再自动补回示例知识库
    await putMeta(META_KNOWLEDGE_SEEDED, true);
  }, [applyArticles, applyExercises, applySubstitutions, applyTemplates]);

  const restoreDefaults = useCallback(async () => {
    const defaults = createDefaultExercises();
    const knownNames = new Set(exercisesRef.current.map((e) => e.name));
    const additions = defaults.filter((d) => !knownNames.has(d.name));
    if (additions.length === 0) return;
    const next = [...exercisesRef.current, ...additions];
    applyExercises(next);
    await bulkWrite({ sessions: sessionsRef.current, exercises: next, meta: [] });
  }, [applyExercises]);

  /* ---------- 训练模板 ---------- */
  const createTemplate = useCallback<GymLogContextValue['createTemplate']>(
    async (input) => {
      const ts = nowISO();
      const template: TrainingTemplate = {
        id: uid(),
        name: normalizeName(input.name) || '未命名模板',
        targetMuscles: input.targetMuscles.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        exercises: input.exercises.map(normalizeTemplateExercise),
        isFavorite: input.isFavorite === true,
        ...(input.builtin ? { builtin: true } : {}),
        createdAt: ts,
        updatedAt: ts,
      };
      applyTemplates([template, ...templatesRef.current]);
      await putTemplate(template);
      return template;
    },
    [applyTemplates],
  );

  const updateTemplate = useCallback<GymLogContextValue['updateTemplate']>(
    async (id, patch) => {
      const target = templatesRef.current.find((item) => item.id === id);
      if (!target) return;
      const nextName = normalizeName(patch.name ?? target.name) || target.name;
      const updated: TrainingTemplate = {
        ...target,
        ...patch,
        name: nextName,
        exercises: (patch.exercises ?? target.exercises).map(normalizeTemplateExercise),
        updatedAt: nowISO(),
      };
      applyTemplates(templatesRef.current.map((item) => (item.id === id ? updated : item)));
      await putTemplate(updated);
    },
    [applyTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      // 只删模板，已导入到训练记录里的动作卡片不受影响
      applyTemplates(templatesRef.current.filter((item) => item.id !== id));
      await dbRemoveTemplate(id);
    },
    [applyTemplates],
  );

  const duplicateTemplate = useCallback<GymLogContextValue['duplicateTemplate']>(
    async (id) => {
      const source = templatesRef.current.find((item) => item.id === id);
      if (!source) return null;
      const ts = nowISO();
      const copy: TrainingTemplate = {
        ...source,
        id: uid(),
        name: `${source.name}（副本）`,
        exercises: source.exercises.map((item) => ({ ...item, id: uid() })),
        isFavorite: false,
        builtin: false,
        createdAt: ts,
        updatedAt: ts,
      };
      applyTemplates([copy, ...templatesRef.current]);
      await putTemplate(copy);
      return copy;
    },
    [applyTemplates],
  );

  /* ---------- 知识文章 ---------- */
  const createArticle = useCallback<GymLogContextValue['createArticle']>(
    async (input) => {
      const ts = nowISO();
      const article: KnowledgeArticle = {
        id: uid(),
        title: input.title.trim() || '未命名文章',
        category: input.category,
        body: input.body.trim(),
        ...(input.link?.url ? { link: input.link } : {}),
        ...(input.exerciseIds?.length ? { exerciseIds: [...new Set(input.exerciseIds)] } : {}),
        isFavorite: input.isFavorite === true,
        ...(input.needsReview ? { needsReview: true } : {}),
        createdAt: ts,
        updatedAt: ts,
      };
      applyArticles([article, ...articlesRef.current]);
      await putArticle(article);
      return article;
    },
    [applyArticles],
  );

  const updateArticle = useCallback<GymLogContextValue['updateArticle']>(
    async (id, patch) => {
      const target = articlesRef.current.find((item) => item.id === id);
      if (!target) return;
      const updated: KnowledgeArticle = {
        ...target,
        ...patch,
        title: (patch.title ?? target.title).trim() || target.title,
        body: patch.body !== undefined ? patch.body.trim() : target.body,
        updatedAt: nowISO(),
      };
      if (patch.exerciseIds) updated.exerciseIds = [...new Set(patch.exerciseIds)];
      if (patch.link === undefined && 'link' in patch) delete updated.link;
      applyArticles(articlesRef.current.map((item) => (item.id === id ? updated : item)));
      await putArticle(updated);
    },
    [applyArticles],
  );

  const deleteArticle = useCallback(
    async (id: string) => {
      applyArticles(articlesRef.current.filter((item) => item.id !== id));
      await dbRemoveArticle(id);
    },
    [applyArticles],
  );

  /* ---------- 动作替代 ---------- */
  const createSubstitution = useCallback<GymLogContextValue['createSubstitution']>(
    async (input) => {
      if (!input.fromExerciseId || !input.toExerciseId) return null;
      if (input.fromExerciseId === input.toExerciseId) return null;
      const existing = substitutionsRef.current.find(
        (item) =>
          item.fromExerciseId === input.fromExerciseId && item.toExerciseId === input.toExerciseId,
      );
      const item: ExerciseSubstitution = {
        id: existing?.id ?? uid(),
        fromExerciseId: input.fromExerciseId,
        toExerciseId: input.toExerciseId,
        similarity: input.similarity,
        ...(input.primaryMuscles?.length ? { primaryMuscles: input.primaryMuscles } : {}),
        ...(input.movementPattern ? { movementPattern: input.movementPattern } : {}),
        difference: input.difference.trim() || '未填写具体区别，请结合动作模式判断。',
        ...(input.equipment ? { equipment: input.equipment } : {}),
        ...(input.caution ? { caution: input.caution } : {}),
        createdAt: existing?.createdAt ?? nowISO(),
      };
      applySubstitutions([...substitutionsRef.current.filter((sub) => sub.id !== item.id), item]);
      await putSubstitution(item);
      return item;
    },
    [applySubstitutions],
  );

  const deleteSubstitution = useCallback(
    async (id: string) => {
      applySubstitutions(substitutionsRef.current.filter((item) => item.id !== id));
      await dbRemoveSubstitution(id);
    },
    [applySubstitutions],
  );

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = normalizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    await putMeta(META_SETTINGS, next);
  }, []);

  const setTheme = useCallback(
    async (theme: AppSettings['theme']) => {
      await updateSettings({ theme });
    },
    [updateSettings],
  );

  const value: GymLogContextValue = {
    ready,
    storageError,
    sessions,
    exercises,
    templates,
    articles,
    substitutions,
    lastInputs,
    settings,
    getSession,
    lastEntryBefore,
    addExerciseToSession,
    addSet,
    updateSet,
    deleteSet,
    deleteEntry,
    renameEntry,
    replaceEntryExercise,
    moveEntry,
    setSortMode,
    setNote,
    resetSessionStart,
    deleteSession,
    undoLastAdd,
    createExercise,
    updateExercise,
    deleteExercise,
    importData,
    clearAll,
    setTheme,
    updateSettings,
    restoreDefaults,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    createArticle,
    updateArticle,
    deleteArticle,
    createSubstitution,
    deleteSubstitution,
  };

  return <GymLogContext.Provider value={value}>{children}</GymLogContext.Provider>;
}

export function useGymLog(): GymLogContextValue {
  const ctx = useContext(GymLogContext);
  if (!ctx) throw new Error('useGymLog 必须在 GymLogProvider 内部使用');
  return ctx;
}

/** 便捷：今日日期（组件内保持稳定） */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}
