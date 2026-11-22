/**
 * JSON 备份：与安卓版 GymLog 的格式保持兼容（v1 / v2 / v3 都能读）。
 * 小程序不能直接下载文件，导出走「写入本地文件 + 分享到聊天」。
 */
import type {
  ArticleCategory,
  ExerciseCatalogItem,
  ExerciseLink,
  ExerciseSubstitution,
  KnowledgeArticle,
  LastInput,
  SetEntry,
  TemplateExercise,
  TrainingTemplate,
  WorkoutSession,
} from './types';
import { ARTICLE_CATEGORIES } from './types';
import { isISODate, nowISO } from './date';
import { isSafeSet, normalizeName } from './validation';
import { safeLinks } from './links';
import { uid } from './id';
import * as S from './storage';
import {
  ensureSeed,
  getLastInputs,
  getSession,
  getSettings,
  listExercises,
  listSessionDates,
  saveSession,
  saveSettings,
} from './store';
import { createDefaultExercises } from './defaults';
import {
  listArticles,
  listSubstitutions,
  listTemplates,
  saveArticle,
  saveTemplate,
} from './knowledge';

export const BACKUP_VERSION = 3;

export interface BackupFile {
  app: 'gymlog';
  version: number;
  exportedAt: string;
  sessions: WorkoutSession[];
  exercises: ExerciseCatalogItem[];
  lastInputs: Record<string, LastInput>;
  templates: TrainingTemplate[];
  articles: KnowledgeArticle[];
  substitutions: ExerciseSubstitution[];
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

/* ==================== 导出 ==================== */

export function buildBackup(): BackupFile {
  return {
    app: 'gymlog',
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    sessions: listSessionDates()
      .map((date) => getSession(date))
      .filter((session): session is WorkoutSession => Boolean(session)),
    exercises: listExercises(),
    lastInputs: getLastInputs(),
    templates: listTemplates(),
    articles: listArticles(),
    substitutions: listSubstitutions(),
  };
}

export function writeBackupFile(): {
  ok: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
} {
  try {
    const fs = wx.getFileSystemManager();
    const fileName = `gymlog-backup-${nowISO().slice(0, 10)}.json`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    fs.writeFileSync(filePath, JSON.stringify(buildBackup(), null, 2), 'utf8');
    return { ok: true, filePath, fileName };
  } catch (error) {
    return { ok: false, error: (error as Error).message || '写入文件失败' };
  }
}

export function shareFile(filePath: string, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof wx.shareFileMessage !== 'function') {
      resolve(false);
      return;
    }
    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

export function readFileText(filePath: string): string | null {
  try {
    const fs = wx.getFileSystemManager();
    return fs.readFileSync(filePath, 'utf8') as string;
  } catch (error) {
    return null;
  }
}

/* ==================== 解析与归一化 ==================== */

function normalizeSet(value: unknown): SetEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const weightKg = Number(raw.weightKg);
  const reps = Number(raw.reps);
  if (!isSafeSet(weightKg, reps)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    weightKg,
    reps,
    ...(raw.type === 'warmup' ? { type: 'warmup' as const } : {}),
    ...(typeof raw.completedAt === 'string' ? { completedAt: raw.completedAt } : {}),
  };
}

function normalizeSession(value: unknown): WorkoutSession | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const date = typeof raw.date === 'string' ? raw.date : '';
  if (!isISODate(date)) return null;

  const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];
  const exercises = rawExercises
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === 'string' ? normalizeName(item.name) : '';
      if (!name) return null;
      const sets = (Array.isArray(item.sets) ? item.sets : [])
        .map(normalizeSet)
        .filter((set): set is SetEntry => set !== null);
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `entry-${date}-${index}`,
        ...(typeof item.exerciseId === 'string' ? { exerciseId: item.exerciseId } : {}),
        name,
        sets,
        order: typeof item.order === 'number' ? item.order : index,
        ...(typeof item.startedAt === 'string' ? { startedAt: item.startedAt } : {}),
        ...(item.target && typeof item.target === 'object'
          ? {
              target: {
                sets: Math.max(1, Math.round(Number((item.target as any).sets) || 3)),
                repMin: Math.max(1, Math.round(Number((item.target as any).repMin) || 8)),
                repMax: Math.max(
                  1,
                  Math.round(
                    Number((item.target as any).repMax) || Number((item.target as any).repMin) || 8,
                  ),
                ),
              },
            }
          : {}),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const ts = typeof raw.updatedAt === 'string' ? raw.updatedAt : nowISO();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `session-${date}`,
    date,
    ...(typeof raw.note === 'string' && raw.note.trim() ? { note: raw.note } : {}),
    exercises,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : ts,
    updatedAt: ts,
    ...(typeof raw.startedAt === 'string' ? { startedAt: raw.startedAt } : {}),
    ...(raw.sortMode === 'time' ? { sortMode: 'time' as const } : {}),
  };
}

function parseStringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeExercise(value: unknown): ExerciseCatalogItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? normalizeName(raw.name) : '';
  if (!name) return null;
  const category =
    typeof raw.category === 'string' && ['胸', '背', '肩', '手臂', '腹', '腿', '其他'].indexOf(raw.category) >= 0
      ? raw.category
      : '其他';
  const links = safeLinks(raw.links);
  const primaryMuscles = parseStringList(raw.primaryMuscles);
  const secondaryMuscles = parseStringList(raw.secondaryMuscles);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name,
    category: category as ExerciseCatalogItem['category'],
    isFavorite: raw.isFavorite === true,
    ...(typeof raw.recentlyUsedAt === 'string' ? { recentlyUsedAt: raw.recentlyUsedAt } : {}),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowISO(),
    ...(typeof raw.description === 'string' && raw.description.trim()
      ? { description: raw.description.trim() }
      : {}),
    ...(links.length ? { links } : {}),
    ...(primaryMuscles.length ? { primaryMuscles } : {}),
    ...(secondaryMuscles.length ? { secondaryMuscles } : {}),
    ...(typeof raw.movementPattern === 'string' && raw.movementPattern
      ? { movementPattern: raw.movementPattern }
      : {}),
    ...(typeof raw.equipment === 'string' && raw.equipment ? { equipment: raw.equipment } : {}),
    ...(typeof raw.steps === 'string' && raw.steps.trim() ? { steps: raw.steps.trim() } : {}),
    ...(typeof raw.commonMistakes === 'string' && raw.commonMistakes.trim()
      ? { commonMistakes: raw.commonMistakes.trim() }
      : {}),
  };
}

function normalizeTemplateExercise(value: unknown, index: number, templateId: string): TemplateExercise | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? normalizeName(raw.name) : '';
  if (!name) return null;
  const repMin = Math.max(1, Math.round(Number(raw.repMin) || 8));
  const rest = Number(raw.restSeconds);
  const linkList = raw.link && typeof raw.link === 'object' ? safeLinks([raw.link]) : [];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${templateId}-e${index + 1}`,
    ...(typeof raw.exerciseId === 'string' ? { exerciseId: raw.exerciseId } : {}),
    name,
    sets: Math.min(20, Math.max(1, Math.round(Number(raw.sets) || 3))),
    repMin,
    repMax: Math.max(repMin, Math.round(Number(raw.repMax) || repMin)),
    ...(Number.isFinite(rest) && rest > 0 ? { restSeconds: Math.round(rest) } : {}),
    ...(linkList.length ? { link: linkList[0] } : {}),
    ...(typeof raw.note === 'string' && raw.note.trim() ? { note: raw.note.trim() } : {}),
  };
}

function normalizeTemplate(value: unknown): TrainingTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? normalizeName(raw.name) : '';
  if (!name) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid();
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map((item, index) => normalizeTemplateExercise(item, index, id))
    .filter((item): item is TemplateExercise => item !== null);
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : nowISO();
  return {
    id,
    name,
    targetMuscles: typeof raw.targetMuscles === 'string' ? raw.targetMuscles.trim() : '',
    ...(typeof raw.description === 'string' && raw.description.trim()
      ? { description: raw.description.trim() }
      : {}),
    exercises,
    isFavorite: raw.isFavorite === true,
    ...(raw.builtin === true ? { builtin: true } : {}),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : updatedAt,
    updatedAt,
  };
}

function normalizeArticle(value: unknown): KnowledgeArticle | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;
  const category: ArticleCategory =
    typeof raw.category === 'string' && ARTICLE_CATEGORIES.indexOf(raw.category as ArticleCategory) >= 0
      ? (raw.category as ArticleCategory)
      : '训练基础';
  const links = raw.link && typeof raw.link === 'object' ? safeLinks([raw.link]) : [];
  const exerciseIds = Array.isArray(raw.exerciseIds)
    ? raw.exerciseIds.filter((item): item is string => typeof item === 'string').slice(0, 20)
    : [];
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : nowISO();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    title,
    category,
    body: typeof raw.body === 'string' ? raw.body : '',
    ...(links.length ? { link: links[0] as ExerciseLink } : {}),
    ...(exerciseIds.length ? { exerciseIds } : {}),
    isFavorite: raw.isFavorite === true,
    ...(raw.needsReview === true ? { needsReview: true } : {}),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : updatedAt,
    updatedAt,
  };
}

function normalizeSubstitution(value: unknown): ExerciseSubstitution | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const fromExerciseId = typeof raw.fromExerciseId === 'string' ? raw.fromExerciseId : '';
  const toExerciseId = typeof raw.toExerciseId === 'string' ? raw.toExerciseId : '';
  if (!fromExerciseId || !toExerciseId || fromExerciseId === toExerciseId) return null;
  const primaryMuscles = parseStringList(raw.primaryMuscles, 6);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    fromExerciseId,
    toExerciseId,
    similarity: raw.similarity === 'close' ? 'close' : 'partial',
    ...(primaryMuscles.length ? { primaryMuscles } : {}),
    ...(typeof raw.movementPattern === 'string' && raw.movementPattern
      ? { movementPattern: raw.movementPattern }
      : {}),
    difference:
      typeof raw.difference === 'string' && raw.difference.trim()
        ? raw.difference.trim()
        : '未填写具体区别，请结合动作模式判断。',
    ...(typeof raw.equipment === 'string' && raw.equipment ? { equipment: raw.equipment } : {}),
    ...(typeof raw.caution === 'string' && raw.caution ? { caution: raw.caution } : {}),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowISO(),
  };
}

function dedupe<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function parseBackup(text: string): { ok: true; data: ParsedBackup } | { ok: false; error: string } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: '不是有效的 JSON 文件' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: '备份内容格式不正确' };
  if (raw.app && raw.app !== 'gymlog') {
    return { ok: false, error: '这不是 GymLog 的备份文件' };
  }

  const sessions = dedupe<WorkoutSession>(
    (Array.isArray(raw.sessions) ? raw.sessions : [])
      .map(normalizeSession)
      .filter((item): item is WorkoutSession => item !== null),
  );
  const exercises = dedupe<ExerciseCatalogItem>(
    (Array.isArray(raw.exercises) ? raw.exercises : [])
      .map(normalizeExercise)
      .filter((item): item is ExerciseCatalogItem => item !== null),
  );
  const templates = dedupe<TrainingTemplate>(
    (Array.isArray(raw.templates) ? raw.templates : [])
      .map(normalizeTemplate)
      .filter((item): item is TrainingTemplate => item !== null),
  );
  const articles = dedupe<KnowledgeArticle>(
    (Array.isArray(raw.articles) ? raw.articles : [])
      .map(normalizeArticle)
      .filter((item): item is KnowledgeArticle => item !== null),
  );
  const substitutions = dedupe<ExerciseSubstitution>(
    (Array.isArray(raw.substitutions) ? raw.substitutions : [])
      .map(normalizeSubstitution)
      .filter((item): item is ExerciseSubstitution => item !== null),
  );

  if (!sessions.length && !exercises.length && !templates.length && !articles.length) {
    return { ok: false, error: '备份里没有可导入的训练记录或知识内容' };
  }

  const lastInputs: Record<string, LastInput> = {};
  const rawLastInputs = raw.lastInputs && typeof raw.lastInputs === 'object' ? raw.lastInputs : {};
  Object.keys(rawLastInputs).forEach((key) => {
    const item = rawLastInputs[key];
    if (!item || typeof item !== 'object') return;
    const weightKg = Number(item.weightKg);
    const reps = Number(item.reps);
    if (!isSafeSet(weightKg, reps)) return;
    lastInputs[key] = {
      weightKg,
      reps,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : nowISO(),
    };
  });

  return {
    ok: true,
    data: {
      sessions,
      exercises,
      lastInputs,
      templates,
      articles,
      substitutions,
      meta: {
        version: typeof raw.version === 'number' ? raw.version : 1,
        exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '未知',
      },
    },
  };
}

/* ==================== 导入 ==================== */

export interface ImportResult {
  sessions: number;
  exercises: number;
  templates: number;
  articles: number;
  substitutions: number;
}

export function importBackup(data: ParsedBackup, mode: 'merge' | 'replace'): ImportResult {
  const result: ImportResult = { sessions: 0, exercises: 0, templates: 0, articles: 0, substitutions: 0 };

  if (mode === 'replace') {
    const settings = getSettings();
    S.clearBusinessData();
    saveSettings(settings);
    data.sessions.forEach((session) => saveSession(session));
    const incomingExercises = data.exercises.length ? data.exercises : createDefaultExercises();
    incomingExercises.forEach((item) => {
      S.write(S.K.exercise(item.id), item);
      S.ensureInIndex(S.K.exerciseIndex, item.id);
    });
    data.templates.forEach((item) => saveTemplate(item));
    data.articles.forEach((item) => saveArticle(item));
    data.substitutions.forEach((item) => {
      S.write(S.K.substitution(item.id), item);
      S.ensureInIndex(S.K.substitutionIndex, item.id);
    });
    S.write(S.K.meta('lastInputs'), data.lastInputs);
    S.write(S.K.meta('seeded'), true);
    S.write(S.K.meta('knowledgeSeeded'), true);
    result.sessions = data.sessions.length;
    result.exercises = incomingExercises.length;
    result.templates = data.templates.length;
    result.articles = data.articles.length;
    result.substitutions = data.substitutions.length;
    return result;
  }

  // 合并：训练记录按日期合并，知识库按 ID 去重，本地优先
  data.sessions.forEach((incoming) => {
    const existing = getSession(incoming.date);
    if (!existing) {
      saveSession(incoming);
      result.sessions += 1;
      return;
    }
    const entries = existing.exercises.map((entry) => ({ ...entry, sets: [...entry.sets] }));
    incoming.exercises.forEach((entry) => {
      const index = entries.findIndex(
        (item) =>
          item.id === entry.id ||
          item.name === entry.name ||
          (entry.exerciseId && item.exerciseId === entry.exerciseId),
      );
      if (index < 0) {
        entries.push({ ...entry, order: entries.length });
        return;
      }
      const target = entries[index];
      const known = new Set(target.sets.map((set) => set.id));
      entries[index] = {
        ...target,
        sets: [...target.sets, ...entry.sets.filter((set) => !known.has(set.id))],
      };
    });
    saveSession({
      ...existing,
      exercises: entries.map((entry, index) => ({ ...entry, order: index })),
      updatedAt: nowISO(),
    });
    result.sessions += 1;
  });

  const existingExercises = listExercises();
  const byId = new Map(existingExercises.map((item) => [item.id, item]));
  const byName = new Map(existingExercises.map((item) => [item.name, item]));
  data.exercises.forEach((incoming) => {
    const existing = byId.get(incoming.id) || byName.get(incoming.name);
    if (!existing) {
      S.write(S.K.exercise(incoming.id), incoming);
      S.ensureInIndex(S.K.exerciseIndex, incoming.id);
      byId.set(incoming.id, incoming);
      byName.set(incoming.name, incoming);
      result.exercises += 1;
      return;
    }
    // 本地优先，只在本地缺资料时补齐
    const next = { ...existing };
    let changed = false;
    if (!next.description && incoming.description) {
      next.description = incoming.description;
      changed = true;
    }
    if ((!next.links || !next.links.length) && incoming.links && incoming.links.length) {
      next.links = incoming.links;
      changed = true;
    }
    ['primaryMuscles', 'secondaryMuscles', 'movementPattern', 'equipment', 'steps', 'commonMistakes'].forEach(
      (key) => {
        if (!next[key] && incoming[key]) {
          next[key] = incoming[key];
          changed = true;
        }
      },
    );
    if (changed) S.write(S.K.exercise(next.id), next);
  });

  const templateIds = new Set(listTemplates().map((item) => item.id));
  data.templates.forEach((item) => {
    if (templateIds.has(item.id)) return;
    saveTemplate(item);
    templateIds.add(item.id);
    result.templates += 1;
  });

  const articleIds = new Set(listArticles().map((item) => item.id));
  data.articles.forEach((item) => {
    if (articleIds.has(item.id)) return;
    saveArticle(item);
    articleIds.add(item.id);
    result.articles += 1;
  });

  const subKeys = new Set(listSubstitutions().map((item) => `${item.fromExerciseId}>${item.toExerciseId}`));
  data.substitutions.forEach((item) => {
    const key = `${item.fromExerciseId}>${item.toExerciseId}`;
    if (subKeys.has(key)) return;
    S.write(S.K.substitution(item.id), item);
    S.ensureInIndex(S.K.substitutionIndex, item.id);
    subKeys.add(key);
    result.substitutions += 1;
  });

  S.write(S.K.meta('lastInputs'), { ...data.lastInputs, ...getLastInputs() });
  if (listExercises().length === 0) ensureSeed();
  return result;
}
