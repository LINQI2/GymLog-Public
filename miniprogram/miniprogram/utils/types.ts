/** 与安卓版 GymLog 保持一致的数据结构（便于第三阶段备份互通） */

export type ExerciseCategory = '胸' | '背' | '肩' | '手臂' | '腹' | '腿' | '其他';

export const CATEGORIES: ExerciseCategory[] = ['胸', '背', '肩', '手臂', '腹', '腿', '其他'];

export type SetType = 'normal' | 'warmup';

export interface SetEntry {
  id: string;
  weightKg: number;
  reps: number;
  type?: SetType;
  completedAt?: string;
}

export interface EntryTarget {
  sets: number;
  repMin: number;
  repMax: number;
}

export interface ExerciseEntry {
  id: string;
  exerciseId?: string;
  name: string;
  sets: SetEntry[];
  order: number;
  startedAt?: string;
  target?: EntryTarget;
}

export interface WorkoutSession {
  id: string;
  date: string;
  note?: string;
  exercises: ExerciseEntry[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  sortMode?: 'manual' | 'time';
}

export interface ExerciseLink {
  id: string;
  title: string;
  url: string;
}

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  category: ExerciseCategory;
  isFavorite: boolean;
  recentlyUsedAt?: string;
  createdAt: string;
  description?: string;
  links?: ExerciseLink[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  movementPattern?: string;
  equipment?: string;
  steps?: string;
  commonMistakes?: string;
}

export interface LastInput {
  weightKg: number;
  reps: number;
  updatedAt: string;
}

export interface AppSettings {
  restSeconds: number;
  restAutoStart: boolean;
  restVibrate: boolean;
  restSound: boolean;
}

export interface SessionStats {
  exerciseCount: number;
  setCount: number;
  reps: number;
  volume: number;
}

/* ==================== 训练模板 ==================== */

export interface TemplateExercise {
  id: string;
  exerciseId?: string;
  name: string;
  /** 建议组数 */
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds?: number;
  link?: ExerciseLink;
  note?: string;
}

export interface TrainingTemplate {
  id: string;
  name: string;
  targetMuscles: string;
  description?: string;
  exercises: TemplateExercise[];
  isFavorite: boolean;
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==================== 知识文章 ==================== */

export type ArticleCategory = '肩' | '背' | '胸' | '腹' | '手臂' | '腿' | '训练基础' | '恢复与安全';

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  '肩',
  '背',
  '胸',
  '腹',
  '手臂',
  '腿',
  '训练基础',
  '恢复与安全',
];

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: ArticleCategory;
  /** 正文：支持「## 小标题」「- 列表」与空行分段 */
  body: string;
  link?: ExerciseLink;
  exerciseIds?: string[];
  isFavorite: boolean;
  /** 内容待审核 */
  needsReview?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==================== 动作替代 ==================== */

export type SubstitutionSimilarity = 'close' | 'partial';

export interface ExerciseSubstitution {
  id: string;
  fromExerciseId: string;
  toExerciseId: string;
  similarity: SubstitutionSimilarity;
  primaryMuscles?: string[];
  movementPattern?: string;
  difference: string;
  equipment?: string;
  caution?: string;
  createdAt: string;
}

export const MOVEMENT_PATTERNS = [
  '水平推',
  '垂直推',
  '水平拉',
  '垂直拉',
  '肩外展',
  '肩水平外展',
  '肘屈',
  '肘伸',
  '髋伸',
  '膝伸',
  '膝屈',
  '核心屈曲',
  '其他',
] as string[];

export const EQUIPMENT_OPTIONS = ['杠铃', '哑铃', '器械', '绳索', '自重', '弹力带', '其他'] as string[];
