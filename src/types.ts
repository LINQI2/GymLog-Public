/** 动作分类（仅用于筛选） */
export type ExerciseCategory = '胸' | '背' | '肩' | '手臂' | '腹' | '腿' | '其他';

export const CATEGORIES: ExerciseCategory[] = ['胸', '背', '肩', '手臂', '腹', '腿', '其他'];

/** 组类型：普通组 / 热身组 */
export type SetType = 'normal' | 'warmup';

/** 单组记录 */
export interface SetEntry {
  id: string;
  /** 非负数字，支持小数；自重动作允许 0 */
  weightKg: number;
  /** 正整数 */
  reps: number;
  type?: SetType;
  completedAt?: string;
}

/** 从模板带过来的建议训练量，只是目标，不计入已完成训练量 */
export interface EntryTarget {
  sets: number;
  repMin: number;
  repMax: number;
}

/** 一次训练中的某个动作 */
export interface ExerciseEntry {
  id: string;
  /** 关联动作库（动作库被删除后该字段可能失效，不影响历史） */
  exerciseId?: string;
  /** 当时的动作名称快照 */
  name: string;
  sets: SetEntry[];
  order: number;
  /** 这个动作第一次被记录的时间（ISO）；v1 旧数据没有，读取时用首组完成时间兜底 */
  startedAt?: string;
  /** 模板导入时的建议组数/次数，仅作目标展示 */
  target?: EntryTarget;
}

/** 动作排序方式：手动 / 按动作开始时间 */
export type EntrySortMode = 'manual' | 'time';

/** 某一天的训练记录 */
export interface WorkoutSession {
  id: string;
  /** 本地日期 YYYY-MM-DD（不受 UTC 时区影响） */
  date: string;
  note?: string;
  exercises: ExerciseEntry[];
  createdAt: string;
  updatedAt: string;
  /** 当天第一次开始练的时间（ISO）；旧数据用 createdAt 兜底 */
  startedAt?: string;
  /** 动作卡片的排序方式，默认手动 */
  sortMode?: EntrySortMode;
}

/** 动作学习资料里的一个链接（教学视频 / 网页） */
export interface ExerciseLink {
  id: string;
  /** 显示标题，例如「谭成义教学」，允许为空（界面回退为平台名） */
  title: string;
  /** 已校验的完整网址，只允许 http / https */
  url: string;
}

/** 动作模式：用于判断两个动作是否真的接近，而不是只看肌群 */
export type MovementPattern =
  | '水平推'
  | '垂直推'
  | '水平拉'
  | '垂直拉'
  | '肩外展'
  | '肩水平外展'
  | '肘屈'
  | '肘伸'
  | '髋伸'
  | '膝伸'
  | '膝屈'
  | '核心屈曲'
  | '其他';

export const MOVEMENT_PATTERNS: MovementPattern[] = [
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
];

export const EQUIPMENT_OPTIONS = ['杠铃', '哑铃', '器械', '绳索', '自重', '弹力带', '其他'];

/** 动作库条目 */
export interface ExerciseCatalogItem {
  id: string;
  name: string;
  category: ExerciseCategory;
  isFavorite: boolean;
  recentlyUsedAt?: string;
  createdAt: string;
  /** 动作简介（可多行）。v1 旧数据没有这个字段，读取时按空处理 */
  description?: string;
  /** 教学链接列表。v1 旧数据没有这个字段，读取时按空数组处理 */
  links?: ExerciseLink[];
  /* ---------- 动作知识字段，全部可选，旧动作没有时界面按空处理 ---------- */
  /** 主要肌群，例如「三角肌中束」 */
  primaryMuscles?: string[];
  /** 辅助肌群 */
  secondaryMuscles?: string[];
  /** 动作模式，例如「肩外展」 */
  movementPattern?: string;
  /** 器械类型，例如「哑铃」 */
  equipment?: string;
  /** 动作步骤（多行文本） */
  steps?: string;
  /** 常见错误（多行文本） */
  commonMistakes?: string;
}

/* ==================== 训练模板 ==================== */

/** 模板里的一个动作（名称是快照，动作库删除后模板仍可显示） */
export interface TemplateExercise {
  id: string;
  exerciseId?: string;
  name: string;
  /** 建议组数 */
  sets: number;
  /** 每组目标次数下限 */
  repMin: number;
  /** 每组目标次数上限 */
  repMax: number;
  /** 可选休息时间（秒） */
  restSeconds?: number;
  /** 可选教学链接 */
  link?: ExerciseLink;
  note?: string;
}

export interface TrainingTemplate {
  id: string;
  name: string;
  /** 目标肌群，自由文本，例如「肩 · 三角肌中束」 */
  targetMuscles: string;
  description?: string;
  exercises: TemplateExercise[];
  isFavorite: boolean;
  /** 内置示例（可以编辑、复制、删除） */
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==================== 知识文章 ==================== */

export type ArticleCategory =
  | '肩'
  | '背'
  | '胸'
  | '腹'
  | '手臂'
  | '腿'
  | '训练基础'
  | '恢复与安全';

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
  /** 正文：纯文本，支持「## 小标题」「- 列表」「空行分段」 */
  body: string;
  /** 可选教学网址 */
  link?: ExerciseLink;
  /** 关联的动作库 ID */
  exerciseIds?: string[];
  isFavorite: boolean;
  /** 内容待审核（表述无法充分验证时使用） */
  needsReview?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==================== 动作替代 ==================== */

/** 相似程度：较接近 / 部分替代 */
export type SubstitutionSimilarity = 'close' | 'partial';

export interface ExerciseSubstitution {
  id: string;
  /** 原动作（动作库 ID） */
  fromExerciseId: string;
  /** 替代动作（动作库 ID） */
  toExerciseId: string;
  similarity: SubstitutionSimilarity;
  /** 主要训练肌肉 */
  primaryMuscles?: string[];
  /** 动作模式 */
  movementPattern?: string;
  /** 主要区别 */
  difference: string;
  /** 所需器械 */
  equipment?: string;
  /** 注意事项 */
  caution?: string;
  createdAt: string;
}

/** 某动作最近一次输入的记忆值 */
export interface LastInput {
  weightKg: number;
  reps: number;
  updatedAt: string;
}

/** 应用设置 */
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  /** 组间休息默认时长（秒）。旧版本设置里没有该字段，读取时回退到 90 */
  restSeconds: number;
  /** 记录一组后自动开始休息计时 */
  restAutoStart: boolean;
  /** 休息结束震动（需要系统震动权限，未授权时静默失败） */
  restVibrate: boolean;
  /** 休息结束提示音（网页音效，锁屏/后台时可能被系统暂停） */
  restSound: boolean;
}

/** 导出文件格式 */
export interface BackupFile {
  app: 'gymlog';
  version: number;
  exportedAt: string;
  sessions: WorkoutSession[];
  exercises: ExerciseCatalogItem[];
  lastInputs?: Record<string, LastInput>;
  templates?: TrainingTemplate[];
  articles?: KnowledgeArticle[];
  substitutions?: ExerciseSubstitution[];
}

/**
 * 备份版本：
 * 1 -> 2：动作库条目新增 description / links
 * 2 -> 3：新增训练模板 / 知识文章 / 替代关系（均可选，旧备份仍可导入）
 */
export const BACKUP_VERSION = 3;
