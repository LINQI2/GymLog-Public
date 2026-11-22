/**
 * 训练模板、知识文章、动作替代关系。
 * 与训练记录分开存储，互不影响；删除模板不会改动已导入的训练。
 */
import type {
  ArticleCategory,
  ExerciseLink,
  ExerciseSubstitution,
  KnowledgeArticle,
  SubstitutionSimilarity,
  TemplateExercise,
  TrainingTemplate,
} from './types';
import { ARTICLE_CATEGORIES } from './types';
import { nowISO } from './date';
import { uid } from './id';
import { normalizeName } from './validation';
import { safeLinks } from './links';
import * as S from './storage';
import { addExerciseToSession, getSession, listExercises } from './store';

/* ==================== 模板 ==================== */

export function listTemplates(): TrainingTemplate[] {
  return S.readIndex(S.K.templateIndex)
    .map((id) => S.read<TrainingTemplate | null>(S.K.template(id), null))
    .filter((item): item is TrainingTemplate => Boolean(item && item.id))
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
}

export function getTemplate(id: string): TrainingTemplate | null {
  return S.read<TrainingTemplate | null>(S.K.template(id), null);
}

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
    ...(item.link && item.link.url ? { link: item.link } : {}),
    ...(item.note && item.note.trim() ? { note: item.note.trim() } : {}),
  };
}

export function saveTemplate(template: TrainingTemplate): void {
  const next: TrainingTemplate = {
    ...template,
    name: normalizeName(template.name) || '未命名模板',
    updatedAt: template.updatedAt || nowISO(),
    exercises: template.exercises.map(normalizeTemplateExercise),
  };
  S.write(S.K.template(next.id), next);
  S.ensureInIndex(S.K.templateIndex, next.id);
}

export function createTemplate(input: {
  name: string;
  targetMuscles?: string;
  description?: string;
  exercises?: TemplateExercise[];
}): TrainingTemplate {
  const ts = nowISO();
  const template: TrainingTemplate = {
    id: uid(),
    name: normalizeName(input.name) || '新训练模板',
    targetMuscles: (input.targetMuscles || '').trim(),
    ...(input.description && input.description.trim() ? { description: input.description.trim() } : {}),
    exercises: (input.exercises || []).map(normalizeTemplateExercise),
    isFavorite: false,
    createdAt: ts,
    updatedAt: ts,
  };
  saveTemplate(template);
  return template;
}

export function updateTemplate(id: string, patch: Partial<TrainingTemplate>): TrainingTemplate | null {
  const target = getTemplate(id);
  if (!target) return null;
  const next: TrainingTemplate = {
    ...target,
    ...patch,
    id: target.id,
    createdAt: target.createdAt,
    updatedAt: nowISO(),
  };
  saveTemplate(next);
  return getTemplate(id);
}

export function deleteTemplate(id: string): void {
  S.remove(S.K.template(id));
  S.removeFromIndex(S.K.templateIndex, id);
}

export function duplicateTemplate(id: string): TrainingTemplate | null {
  const source = getTemplate(id);
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
  saveTemplate(copy);
  return copy;
}

export function toggleTemplateFavorite(id: string): void {
  const target = getTemplate(id);
  if (!target) return;
  updateTemplate(id, { isFavorite: !target.isFavorite });
}

/**
 * 把模板动作加到某一天：只创建动作卡片（带目标组数/次数），不生成已完成的组。
 * 当天已存在的同名/同动作会被跳过，绝不覆盖已有记录。
 */
export function applyTemplateToDate(
  date: string,
  template: TrainingTemplate,
  selectedIds: string[],
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const item of template.exercises) {
    if (selectedIds.indexOf(item.id) < 0) continue;
    const session = getSession(date);
    const exists =
      session &&
      session.exercises.some(
        (entry) =>
          (item.exerciseId && entry.exerciseId === item.exerciseId) || entry.name === item.name,
      );
    if (exists) {
      skipped += 1;
      continue;
    }
    addExerciseToSession(date, {
      exerciseId: item.exerciseId,
      name: item.name,
      target: { sets: item.sets, repMin: item.repMin, repMax: item.repMax },
    });
    added += 1;
  }
  return { added, skipped };
}

/* ==================== 知识文章 ==================== */

export function listArticles(): KnowledgeArticle[] {
  return S.readIndex(S.K.articleIndex)
    .map((id) => S.read<KnowledgeArticle | null>(S.K.article(id), null))
    .filter((item): item is KnowledgeArticle => Boolean(item && item.id))
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
}

export function getArticle(id: string): KnowledgeArticle | null {
  return S.read<KnowledgeArticle | null>(S.K.article(id), null);
}

function normalizeCategory(value: unknown): ArticleCategory {
  return ARTICLE_CATEGORIES.indexOf(value as ArticleCategory) >= 0
    ? (value as ArticleCategory)
    : '训练基础';
}

export function createArticle(input: {
  title: string;
  category: ArticleCategory;
  body: string;
  link?: ExerciseLink;
  exerciseIds?: string[];
}): KnowledgeArticle {
  const ts = nowISO();
  const article: KnowledgeArticle = {
    id: uid(),
    title: input.title.trim() || '未命名文章',
    category: normalizeCategory(input.category),
    body: input.body || '',
    ...(input.link && input.link.url ? { link: input.link } : {}),
    ...(input.exerciseIds && input.exerciseIds.length
      ? { exerciseIds: input.exerciseIds.slice(0, 20) }
      : {}),
    isFavorite: false,
    createdAt: ts,
    updatedAt: ts,
  };
  saveArticle(article);
  return article;
}

export function saveArticle(article: KnowledgeArticle): void {
  S.write(S.K.article(article.id), article);
  S.ensureInIndex(S.K.articleIndex, article.id);
}

export function updateArticle(id: string, patch: Partial<KnowledgeArticle>): KnowledgeArticle | null {
  const target = getArticle(id);
  if (!target) return null;
  const next: KnowledgeArticle = {
    ...target,
    ...patch,
    id: target.id,
    category: normalizeCategory(patch.category || target.category),
    title: (patch.title !== undefined ? patch.title : target.title).trim() || target.title,
    createdAt: target.createdAt,
    updatedAt: nowISO(),
  };
  saveArticle(next);
  return getArticle(id);
}

export function deleteArticle(id: string): void {
  S.remove(S.K.article(id));
  S.removeFromIndex(S.K.articleIndex, id);
}

export function toggleArticleFavorite(id: string): void {
  const target = getArticle(id);
  if (!target) return;
  updateArticle(id, { isFavorite: !target.isFavorite });
}

/* ==================== 动作替代 ==================== */

export function listSubstitutions(): ExerciseSubstitution[] {
  return S.readIndex(S.K.substitutionIndex)
    .map((id) => S.read<ExerciseSubstitution | null>(S.K.substitution(id), null))
    .filter((item): item is ExerciseSubstitution => Boolean(item && item.id))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function substitutionsFor(exerciseId: string): ExerciseSubstitution[] {
  return listSubstitutions().filter((item) => item.fromExerciseId === exerciseId);
}

export function createSubstitution(input: {
  fromExerciseId: string;
  toExerciseId: string;
  similarity: SubstitutionSimilarity;
  difference: string;
  primaryMuscles?: string[];
  movementPattern?: string;
  equipment?: string;
  caution?: string;
}): ExerciseSubstitution | null {
  if (!input.fromExerciseId || !input.toExerciseId) return null;
  if (input.fromExerciseId === input.toExerciseId) return null;
  const existing = listSubstitutions().find(
    (item) =>
      item.fromExerciseId === input.fromExerciseId && item.toExerciseId === input.toExerciseId,
  );
  const item: ExerciseSubstitution = {
    id: existing ? existing.id : uid(),
    fromExerciseId: input.fromExerciseId,
    toExerciseId: input.toExerciseId,
    similarity: input.similarity === 'close' ? 'close' : 'partial',
    ...(input.primaryMuscles && input.primaryMuscles.length
      ? { primaryMuscles: input.primaryMuscles.slice(0, 6) }
      : {}),
    ...(input.movementPattern ? { movementPattern: input.movementPattern } : {}),
    difference: input.difference.trim() || '未填写具体区别，请结合动作模式判断。',
    ...(input.equipment ? { equipment: input.equipment } : {}),
    ...(input.caution ? { caution: input.caution } : {}),
    createdAt: existing ? existing.createdAt : nowISO(),
  };
  S.write(S.K.substitution(item.id), item);
  S.ensureInIndex(S.K.substitutionIndex, item.id);
  return item;
}

export function deleteSubstitution(id: string): void {
  S.remove(S.K.substitution(id));
  S.removeFromIndex(S.K.substitutionIndex, id);
}

/* ==================== 关联查询 ==================== */

export function articlesForExercise(exerciseId: string): KnowledgeArticle[] {
  return listArticles().filter((item) => (item.exerciseIds || []).indexOf(exerciseId) >= 0);
}

export function templatesForExercise(ref: { id?: string; name: string }): TrainingTemplate[] {
  return listTemplates().filter((template) =>
    template.exercises.some(
      (item) => (ref.id && item.exerciseId === ref.id) || item.name === ref.name,
    ),
  );
}

/** 动作 ID -> 替代数量 */
export function substitutionCountMap(): Record<string, number> {
  const map: Record<string, number> = {};
  listSubstitutions().forEach((item) => {
    map[item.fromExerciseId] = (map[item.fromExerciseId] || 0) + 1;
  });
  return map;
}

/** 替代目标（带动作库信息），过滤掉动作库里已不存在的条目 */
export function substitutionTargets(exerciseId: string): Array<{
  substitution: ExerciseSubstitution;
  target: { id: string; name: string; category: string; links?: ExerciseLink[] };
}> {
  const exercises = listExercises();
  const result: Array<{
    substitution: ExerciseSubstitution;
    target: { id: string; name: string; category: string; links?: ExerciseLink[] };
  }> = [];
  substitutionsFor(exerciseId).forEach((substitution) => {
    const target = exercises.find((item) => item.id === substitution.toExerciseId);
    if (!target) return;
    result.push({
      substitution,
      target: {
        id: target.id,
        name: target.name,
        category: target.category,
        links: safeLinks(target.links),
      },
    });
  });
  return result;
}
