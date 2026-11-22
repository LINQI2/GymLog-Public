import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ExerciseCatalogItem,
  ExerciseSubstitution,
  KnowledgeArticle,
  TrainingTemplate,
  WorkoutSession,
} from '../types';

export interface MetaRecord {
  key: string;
  value: unknown;
}

interface GymLogDB extends DBSchema {
  sessions: {
    key: string;
    value: WorkoutSession;
    indexes: { 'by-date': string };
  };
  exercises: {
    key: string;
    value: ExerciseCatalogItem;
    indexes: { 'by-name': string };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
  templates: {
    key: string;
    value: TrainingTemplate;
    indexes: { 'by-name': string };
  };
  articles: {
    key: string;
    value: KnowledgeArticle;
    indexes: { 'by-category': string };
  };
  substitutions: {
    key: string;
    value: ExerciseSubstitution;
    indexes: { 'by-from': string };
  };
}

export const DB_NAME = 'gymlog';
/**
 * v1：sessions / exercises / meta
 * v2：新增 templates / articles / substitutions（只增不删，升级不会清空旧数据）
 */
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<GymLogDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<GymLogDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GymLogDB>(DB_NAME, DB_VERSION, {
      // 用 contains 判断逐个补齐 store：从 v1 升级时旧 store 与数据保持原样
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by-date', 'date', { unique: true });
        }
        if (!db.objectStoreNames.contains('exercises')) {
          const store = db.createObjectStore('exercises', { keyPath: 'id' });
          store.createIndex('by-name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          const store = db.createObjectStore('templates', { keyPath: 'id' });
          store.createIndex('by-name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('articles')) {
          const store = db.createObjectStore('articles', { keyPath: 'id' });
          store.createIndex('by-category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('substitutions')) {
          const store = db.createObjectStore('substitutions', { keyPath: 'id' });
          store.createIndex('by-from', 'fromExerciseId', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/** 检查浏览器是否允许使用本地存储（隐私模式/禁用 Cookie 时可能失败） */
export async function checkStorage(): Promise<{ ok: boolean; message?: string }> {
  try {
    await getDB();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '浏览器禁止了本地数据库',
    };
  }
}

export interface Snapshot {
  sessions: WorkoutSession[];
  exercises: ExerciseCatalogItem[];
  meta: MetaRecord[];
  templates: TrainingTemplate[];
  articles: KnowledgeArticle[];
  substitutions: ExerciseSubstitution[];
}

export async function loadAll(): Promise<Snapshot> {
  const db = await getDB();
  const [sessions, exercises, meta, templates, articles, substitutions] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('exercises'),
    db.getAll('meta'),
    db.getAll('templates'),
    db.getAll('articles'),
    db.getAll('substitutions'),
  ]);
  return { sessions, exercises, meta, templates, articles, substitutions };
}

export async function putSession(session: WorkoutSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function removeSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

export async function putExercise(item: ExerciseCatalogItem): Promise<void> {
  const db = await getDB();
  await db.put('exercises', item);
}

export async function removeExercise(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('exercises', id);
}

export async function putTemplate(item: TrainingTemplate): Promise<void> {
  const db = await getDB();
  await db.put('templates', item);
}

export async function removeTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

export async function putArticle(item: KnowledgeArticle): Promise<void> {
  const db = await getDB();
  await db.put('articles', item);
}

export async function removeArticle(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('articles', id);
}

export async function putSubstitution(item: ExerciseSubstitution): Promise<void> {
  const db = await getDB();
  await db.put('substitutions', item);
}

export async function removeSubstitution(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('substitutions', id);
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const record = await db.get('meta', key);
  return record?.value as T | undefined;
}

const ALL_STORES = ['sessions', 'exercises', 'meta', 'templates', 'articles', 'substitutions'] as const;

/** 批量写入（用于导入） */
export async function bulkWrite(
  data: Partial<Snapshot>,
  options: { replace?: boolean } = {},
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  if (options.replace) {
    await Promise.all(ALL_STORES.map((name) => tx.objectStore(name).clear()));
  }
  const sessions = tx.objectStore('sessions');
  const exercises = tx.objectStore('exercises');
  const meta = tx.objectStore('meta');
  const templates = tx.objectStore('templates');
  const articles = tx.objectStore('articles');
  const substitutions = tx.objectStore('substitutions');
  await Promise.all([
    ...(data.sessions ?? []).map((s) => sessions.put(s)),
    ...(data.exercises ?? []).map((e) => exercises.put(e)),
    ...(data.meta ?? []).map((m) => meta.put(m)),
    ...(data.templates ?? []).map((t) => templates.put(t)),
    ...(data.articles ?? []).map((a) => articles.put(a)),
    ...(data.substitutions ?? []).map((s) => substitutions.put(s)),
  ]);
  await tx.done;
}

/** 清空全部数据（用户主动操作） */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  await Promise.all(ALL_STORES.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}

/** 请求浏览器持久化存储权限（尽量避免被自动清理） */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* 忽略：不是所有浏览器都支持 */
  }
  return false;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch {
    /* 忽略 */
  }
  return null;
}
