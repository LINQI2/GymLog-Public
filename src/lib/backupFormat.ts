/**
 * 备份文件的纯数据逻辑（不依赖 Capacitor / 文件系统），便于单独测试。
 * 兼容 v1 旧备份：动作库条目没有 description / links，解析后按空处理。
 */
import type {
  ArticleCategory,
  BackupFile,
  ExerciseCatalogItem,
  ExerciseLink,
  EntryTarget,
  ExerciseSubstitution,
  KnowledgeArticle,
  LastInput,
  SubstitutionSimilarity,
  TemplateExercise,
  TrainingTemplate,
  WorkoutSession,
} from '../types';
import { ARTICLE_CATEGORIES, BACKUP_VERSION } from '../types';
import { isISODate, nowISO } from './date';
import { checkLinkUrl, sanitizeDescription, sanitizeLinks } from './links';
import { isSafeSet, normalizeName } from './validation';

export function buildBackup(
  sessions: WorkoutSession[],
  exercises: ExerciseCatalogItem[],
  lastInputs: Record<string, LastInput>,
  templates: TrainingTemplate[] = [],
  articles: KnowledgeArticle[] = [],
  substitutions: ExerciseSubstitution[] = [],
): BackupFile {
  return {
    app: 'gymlog',
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    sessions: [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
    exercises,
    lastInputs,
    templates,
    articles,
    substitutions,
  };
}

export interface ParsedBackup {
  sessions: WorkoutSession[];
  exercises: ExerciseCatalogItem[];
  lastInputs: Record<string, LastInput>;
  templates: TrainingTemplate[];
  articles: KnowledgeArticle[];
  substitutions: ExerciseSubstitution[];
  meta: { version: number; exportedAt: string };
}

/** 校验并解析导入文件；格式错误时抛出中文错误信息 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON，无法解析。');
  }
  if (!raw || typeof raw !== 'object') throw new Error('文件内容为空或格式不正确。');
  const data = raw as Record<string, unknown>;
  if (data.app !== 'gymlog') throw new Error('这不是 GymLog 导出的备份文件。');

  const rawSessions = Array.isArray(data.sessions) ? data.sessions : [];
  const rawExercises = Array.isArray(data.exercises) ? data.exercises : [];
  const sessions: WorkoutSession[] = [];

  for (const item of rawSessions) {
    const session = normalizeSession(item);
    if (session) sessions.push(session);
  }
  const exercises: ExerciseCatalogItem[] = [];
  for (const item of rawExercises) {
    const exercise = normalizeExercise(item);
    if (exercise) exercises.push(exercise);
  }
  const templates = normalizeTemplates(data.templates);
  const articles = normalizeArticles(data.articles);
  const substitutions = normalizeSubstitutions(data.substitutions);

  if (sessions.length === 0 && exercises.length === 0 && templates.length === 0 && articles.length === 0) {
    throw new Error('备份文件里没有任何可用数据。');
  }

  const lastInputs: Record<string, LastInput> = {};
  const rawLastInputs = data.lastInputs;
  if (rawLastInputs && typeof rawLastInputs === 'object') {
    for (const [key, value] of Object.entries(rawLastInputs as Record<string, unknown>)) {
      const v = value as Partial<LastInput> | undefined;
      if (v && typeof v.weightKg === 'number' && typeof v.reps === 'number') {
        lastInputs[key] = { weightKg: v.weightKg, reps: v.reps, updatedAt: v.updatedAt ?? nowISO() };
      }
    }
  }

  return {
    sessions,
    exercises,
    lastInputs,
    templates,
    articles,
    substitutions,
    meta: {
      version: typeof data.version === 'number' ? data.version : 1,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '未知',
    },
  };
}

function normalizeSession(value: unknown): WorkoutSession | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  if (!isISODate(s.date)) return null;
  const exercisesRaw = Array.isArray(s.exercises) ? s.exercises : [];
  const exercises = exercisesRaw
    .map((entry, index) => normalizeEntry(entry, index))
    .filter((entry): entry is WorkoutSession['exercises'][number] => entry !== null);
  return {
    id: typeof s.id === 'string' && s.id ? s.id : `${s.date}`,
    date: s.date,
    note: typeof s.note === 'string' ? s.note : undefined,
    exercises,
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : nowISO(),
    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : nowISO(),
    // v1 旧备份没有这两个字段，读取时按「无开始时间 / 手动排序」处理
    ...(typeof s.startedAt === 'string' ? { startedAt: s.startedAt } : {}),
    ...(s.sortMode === 'time' ? { sortMode: 'time' as const } : {}),
  };
}

function normalizeTarget(value: unknown): EntryTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const t = value as Record<string, unknown>;
  const sets = Number(t.sets);
  const repMin = Number(t.repMin);
  const repMax = Number(t.repMax);
  if (!Number.isFinite(sets) || !Number.isFinite(repMin)) return undefined;
  const min = Math.max(1, Math.round(repMin));
  return {
    sets: Math.max(1, Math.min(20, Math.round(sets))),
    repMin: min,
    repMax: Math.max(min, Math.round(Number.isFinite(repMax) ? repMax : min)),
  };
}

function normalizeEntry(value: unknown, index: number): WorkoutSession['exercises'][number] | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Record<string, unknown>;
  if (typeof e.name !== 'string' || !e.name.trim()) return null;
  const setsRaw = Array.isArray(e.sets) ? e.sets : [];
  const sets = setsRaw
    .map((set, setIndex) => normalizeSet(set, setIndex))
    .filter((set): set is WorkoutSession['exercises'][number]['sets'][number] => set !== null);
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `entry-${index}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId: typeof e.exerciseId === 'string' ? e.exerciseId : undefined,
    name: e.name.trim(),
    sets,
    order: typeof e.order === 'number' ? e.order : index,
    ...(typeof e.startedAt === 'string' ? { startedAt: e.startedAt } : {}),
    ...(normalizeTarget(e.target) ? { target: normalizeTarget(e.target) } : {}),
  };
}

function normalizeSet(value: unknown, index: number): WorkoutSession['exercises'][number]['sets'][number] | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  const weightKg = typeof s.weightKg === 'number' ? s.weightKg : Number(s.weightKg);
  const reps = typeof s.reps === 'number' ? s.reps : Number(s.reps);
  if (!isSafeSet(weightKg, reps)) return null;
  return {
    id: typeof s.id === 'string' && s.id ? s.id : `set-${index}-${Math.random().toString(36).slice(2, 8)}`,
    weightKg,
    reps,
    type: s.type === 'warmup' ? 'warmup' : 'normal',
    completedAt: typeof s.completedAt === 'string' ? s.completedAt : undefined,
  };
}

function sanitizeLink(value: unknown): ExerciseLink | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.url !== 'string') return undefined;
  const checked = checkLinkUrl(record.url);
  if (!checked.ok) return undefined;
  return {
    id: typeof record.id === 'string' && record.id ? record.id : `link-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof record.title === 'string' ? record.title.trim().slice(0, 40) : '',
    url: checked.url,
  };
}

function normalizeTemplateExercise(
  value: unknown,
  index: number,
  templateId: string,
): TemplateExercise | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Record<string, unknown>;
  const name = typeof e.name === 'string' ? normalizeName(e.name) : '';
  if (!name) return null;
  const sets = Number(e.sets);
  const repMin = Number(e.repMin);
  const repMax = Number(e.repMax);
  const rest = Number(e.restSeconds);
  const min = Number.isFinite(repMin) ? Math.max(1, Math.round(repMin)) : 8;
  const max = Number.isFinite(repMax) ? Math.max(min, Math.round(repMax)) : min;
  const link = sanitizeLink(e.link);
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `${templateId}-e${index + 1}`,
    ...(typeof e.exerciseId === 'string' ? { exerciseId: e.exerciseId } : {}),
    name,
    sets: Number.isFinite(sets) ? Math.min(20, Math.max(1, Math.round(sets))) : 3,
    repMin: min,
    repMax: max,
    ...(Number.isFinite(rest) && rest > 0 ? { restSeconds: Math.round(rest) } : {}),
    ...(link ? { link } : {}),
    ...(typeof e.note === 'string' && e.note.trim() ? { note: e.note.trim() } : {}),
  };
}

function normalizeTemplates(value: unknown): TrainingTemplate[] {
  if (!Array.isArray(value)) return [];
  const result: TrainingTemplate[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const t = item as Record<string, unknown>;
    const name = typeof t.name === 'string' ? normalizeName(t.name) : '';
    if (!name) return;
    const id =
      typeof t.id === 'string' && t.id ? t.id : `tpl-${index}-${Math.random().toString(36).slice(2, 8)}`;
    if (ids.has(id)) return;
    ids.add(id);
    const rawExercises = Array.isArray(t.exercises) ? t.exercises : [];
    const exercises = rawExercises
      .map((entry, entryIndex) => normalizeTemplateExercise(entry, entryIndex, id))
      .filter((entry): entry is TemplateExercise => entry !== null);
    const updatedAt = typeof t.updatedAt === 'string' ? t.updatedAt : nowISO();
    result.push({
      id,
      name,
      targetMuscles: typeof t.targetMuscles === 'string' ? t.targetMuscles.trim() : '',
      ...(typeof t.description === 'string' && t.description.trim()
        ? { description: t.description.trim() }
        : {}),
      exercises,
      isFavorite: t.isFavorite === true,
      ...(t.builtin === true ? { builtin: true } : {}),
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : updatedAt,
      updatedAt,
    });
  });
  return result;
}

function normalizeArticles(value: unknown): KnowledgeArticle[] {
  if (!Array.isArray(value)) return [];
  const result: KnowledgeArticle[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const a = item as Record<string, unknown>;
    const title = typeof a.title === 'string' ? a.title.trim() : '';
    if (!title) return;
    const id =
      typeof a.id === 'string' && a.id ? a.id : `art-${index}-${Math.random().toString(36).slice(2, 8)}`;
    if (ids.has(id)) return;
    ids.add(id);
    const category: ArticleCategory =
      typeof a.category === 'string' && ARTICLE_CATEGORIES.includes(a.category as ArticleCategory)
        ? (a.category as ArticleCategory)
        : '训练基础';
    const exerciseIds = Array.isArray(a.exerciseIds)
      ? a.exerciseIds.filter((value2): value2 is string => typeof value2 === 'string')
      : [];
    const link = sanitizeLink(a.link);
    const updatedAt = typeof a.updatedAt === 'string' ? a.updatedAt : nowISO();
    result.push({
      id,
      title,
      category,
      body: typeof a.body === 'string' ? a.body : '',
      ...(link ? { link } : {}),
      ...(exerciseIds.length ? { exerciseIds } : {}),
      isFavorite: a.isFavorite === true,
      ...(a.needsReview === true ? { needsReview: true } : {}),
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : updatedAt,
      updatedAt,
    });
  });
  return result;
}

function normalizeSubstitutions(value: unknown): ExerciseSubstitution[] {
  if (!Array.isArray(value)) return [];
  const result: ExerciseSubstitution[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const s = item as Record<string, unknown>;
    const fromExerciseId = typeof s.fromExerciseId === 'string' ? s.fromExerciseId : '';
    const toExerciseId = typeof s.toExerciseId === 'string' ? s.toExerciseId : '';
    if (!fromExerciseId || !toExerciseId || fromExerciseId === toExerciseId) return;
    const key = `${fromExerciseId}>${toExerciseId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const similarity: SubstitutionSimilarity = s.similarity === 'close' ? 'close' : 'partial';
    const primaryMuscles = Array.isArray(s.primaryMuscles)
      ? s.primaryMuscles.filter((value2): value2 is string => typeof value2 === 'string')
      : [];
    result.push({
      id:
        typeof s.id === 'string' && s.id
          ? s.id
          : `sub-${index}-${Math.random().toString(36).slice(2, 8)}`,
      fromExerciseId,
      toExerciseId,
      similarity,
      ...(primaryMuscles.length ? { primaryMuscles } : {}),
      ...(typeof s.movementPattern === 'string' && s.movementPattern
        ? { movementPattern: s.movementPattern }
        : {}),
      difference:
        typeof s.difference === 'string' && s.difference.trim()
          ? s.difference.trim()
          : '未填写具体区别，请结合动作模式判断。',
      ...(typeof s.equipment === 'string' && s.equipment ? { equipment: s.equipment } : {}),
      ...(typeof s.caution === 'string' && s.caution ? { caution: s.caution } : {}),
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : nowISO(),
    });
  });
  return result;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeExercise(value: unknown): ExerciseCatalogItem | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Record<string, unknown>;
  if (typeof e.name !== 'string' || !e.name.trim()) return null;
  const category = e.category;
  const allowed = ['胸', '背', '肩', '手臂', '腹', '腿', '其他'];
  const description = sanitizeDescription(e.description);
  const links = sanitizeLinks(e.links);
  const primaryMuscles = parseStringList(e.primaryMuscles);
  const secondaryMuscles = parseStringList(e.secondaryMuscles);
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `ex-${Math.random().toString(36).slice(2, 10)}`,
    name: e.name.trim(),
    category: (typeof category === 'string' && allowed.includes(category)
      ? category
      : '其他') as ExerciseCatalogItem['category'],
    isFavorite: e.isFavorite === true,
    recentlyUsedAt: typeof e.recentlyUsedAt === 'string' ? e.recentlyUsedAt : undefined,
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : nowISO(),
    ...(description ? { description } : {}),
    ...(links.length ? { links } : {}),
    ...(primaryMuscles.length ? { primaryMuscles } : {}),
    ...(secondaryMuscles.length ? { secondaryMuscles } : {}),
    ...(typeof e.movementPattern === 'string' && e.movementPattern
      ? { movementPattern: e.movementPattern }
      : {}),
    ...(typeof e.equipment === 'string' && e.equipment ? { equipment: e.equipment } : {}),
    ...(typeof e.steps === 'string' && e.steps.trim() ? { steps: e.steps.trim() } : {}),
    ...(typeof e.commonMistakes === 'string' && e.commonMistakes.trim()
      ? { commonMistakes: e.commonMistakes.trim() }
      : {}),
  };
}
