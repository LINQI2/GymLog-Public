/**
 * 微信本地 Storage 封装。
 *
 * 微信限制：单个 key 最大 1MB，全部 storage 上限 10MB。
 * 因此按「一天一条 session / 一个动作一条」分片存储，只保留很小的索引数组。
 */
const PREFIX = 'gymlog:';

export const K = {
  schema: `${PREFIX}schema`,
  sessionIndex: `${PREFIX}sessions:index`,
  session: (date: string) => `${PREFIX}session:${date}`,
  exerciseIndex: `${PREFIX}exercises:index`,
  exercise: (id: string) => `${PREFIX}exercise:${id}`,
  templateIndex: `${PREFIX}templates:index`,
  template: (id: string) => `${PREFIX}template:${id}`,
  articleIndex: `${PREFIX}articles:index`,
  article: (id: string) => `${PREFIX}article:${id}`,
  substitutionIndex: `${PREFIX}subs:index`,
  substitution: (id: string) => `${PREFIX}sub:${id}`,
  meta: (key: string) => `${PREFIX}meta:${key}`,
  restTimer: `${PREFIX}rest-timer`,
};

/** 与安卓版数据库/备份保持一致的结构版本 */
export const SCHEMA_VERSION = 2;

export function read<T>(key: string, fallback: T): T {
  try {
    const value = wx.getStorageSync(key);
    if (value === '' || value === null || value === undefined) return fallback;
    return value as T;
  } catch (error) {
    return fallback;
  }
}

export function write(key: string, value: any): boolean {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (error) {
    wx.showToast({ title: '本地存储空间不足，请先清理数据', icon: 'none' });
    return false;
  }
}

export function remove(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    /* 忽略 */
  }
}

export function readIndex(key: string): string[] {
  const value = read<string[]>(key, []);
  return Array.isArray(value) ? value : [];
}

export function ensureInIndex(key: string, value: string): void {
  const list = readIndex(key);
  if (list.indexOf(value) >= 0) return;
  list.push(value);
  write(key, list);
}

export function removeFromIndex(key: string, value: string): void {
  const list = readIndex(key).filter((item) => item !== value);
  write(key, list);
}

export interface StorageInfo {
  keys: string[];
  currentSize: number;
  limitSize: number;
}

export function storageInfo(): StorageInfo {
  try {
    const info = wx.getStorageInfoSync();
    return {
      keys: info.keys || [],
      currentSize: info.currentSize || 0,
      limitSize: info.limitSize || 10240,
    };
  } catch (error) {
    return { keys: [], currentSize: 0, limitSize: 10240 };
  }
}

/** 只清空本应用的数据，不动其他 key */
export function clearBusinessData(): void {
  const info = storageInfo();
  info.keys
    .filter((key) => key.indexOf(PREFIX) === 0 && key !== K.schema)
    .forEach((key) => remove(key));
  write(K.schema, SCHEMA_VERSION);
}
