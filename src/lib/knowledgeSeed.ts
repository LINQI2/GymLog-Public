/**
 * 内置示例数据：训练模板、健身知识文章、动作替代关系。
 * 全部只是「可修改的起点」，不含任何研究引用或教练言论；
 * 描述尽量保持在一般性训练常识范围内，涉及身体反应的内容标记为待审核。
 */
import type {
  ArticleCategory,
  ExerciseCatalogItem,
  ExerciseCategory,
  ExerciseSubstitution,
  KnowledgeArticle,
  MovementPattern,
  SubstitutionSimilarity,
  TemplateExercise,
  TrainingTemplate,
} from '../types';
import { nowISO } from './date';
import { uid } from './id';

interface SeedTemplateExercise {
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds?: number;
  note?: string;
}

interface SeedTemplate {
  name: string;
  targetMuscles: string;
  description: string;
  exercises: SeedTemplateExercise[];
}

interface SeedArticle {
  title: string;
  category: ArticleCategory;
  body: string;
  exerciseNames?: string[];
  needsReview?: boolean;
}

interface SeedSubstitution {
  from: string;
  to: string;
  similarity: SubstitutionSimilarity;
  primaryMuscles: string[];
  movementPattern: MovementPattern;
  difference: string;
  equipment: string;
  caution: string;
}

/** 模板与替代关系会用到、但默认动作库没有的动作 */
export const SEED_EXTRA_EXERCISES: Array<[string, ExerciseCategory]> = [
  ['正手哑铃侧平举', '肩'],
  ['反手哑铃侧平举', '肩'],
  ['绳索侧平举', '肩'],
  ['哑铃推肩', '肩'],
  ['面拉', '肩'],
  ['辅助引体向上', '背'],
  ['杠铃卧推', '胸'],
  ['哑铃卧推', '胸'],
  ['上斜哑铃卧推', '胸'],
  ['悬垂举腿', '腹'],
  ['死虫式', '腹'],
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: '肩部训练',
    targetMuscles: '肩 · 三角肌中束 / 前束 / 后束',
    description:
      '示例结构：先做中束外展类动作，再安排推举，最后补后束。组数与次数只是起点，可按恢复情况调整。',
    exercises: [
      { name: '正手哑铃侧平举', sets: 3, repMin: 12, repMax: 15, restSeconds: 60, note: '肘部微屈，避免耸肩借力' },
      { name: '反手哑铃侧平举', sets: 2, repMin: 12, repMax: 15, restSeconds: 60, note: '躯干略前倾，关注中束' },
      { name: '坐姿推肩', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '反向蝴蝶机', sets: 3, repMin: 12, repMax: 15, restSeconds: 60, note: '后束主导，重量不必追求大' },
    ],
  },
  {
    name: '背部训练',
    targetMuscles: '背 · 背阔肌 / 上背',
    description:
      '示例结构：垂直拉为主，配合水平拉与上背动作。若某个器械被占用，可在动作卡片里查找替代动作。',
    exercises: [
      { name: '正握高位下拉', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '坐姿对握划船', sets: 4, repMin: 10, repMax: 12, restSeconds: 90 },
      { name: '辅助引体向上', sets: 3, repMin: 6, repMax: 10, restSeconds: 120, note: '按辅助配重调整难度' },
      { name: '面拉', sets: 3, repMin: 12, repMax: 15, restSeconds: 60, note: '肩胛后缩，避免腰部代偿' },
    ],
  },
  {
    name: '胸部训练',
    targetMuscles: '胸 · 胸大肌',
    description: '示例结构：先做多关节推举，再用夹胸类动作补充。推举与夹胸的负荷不能直接互相比较。',
    exercises: [
      { name: '坐姿推胸', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '上斜哑铃卧推', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '蝴蝶机夹胸', sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
    ],
  },
  {
    name: '腹部训练',
    targetMuscles: '腹 · 腹直肌 / 深层核心',
    description: '示例结构：屈曲类与抗伸展类搭配。腹部训练不替代全身训练与饮食管理。',
    exercises: [
      { name: '仰卧卷腹', sets: 3, repMin: 15, repMax: 20, restSeconds: 45, note: '下背贴地，用腹肌卷起' },
      { name: '悬垂举腿', sets: 3, repMin: 10, repMax: 15, restSeconds: 60, note: '控制摆动，避免用惯性' },
      { name: '死虫式', sets: 3, repMin: 10, repMax: 12, restSeconds: 45, note: '左右各算一次，保持腰部贴地' },
    ],
  },
];

export const SEED_ARTICLES: SeedArticle[] = [
  {
    title: '三角肌前束、中束、后束分别在做什么',
    category: '肩',
    body: `## 三块肌肉，三个主要方向
三角肌分前束、中束、后束，起点与止点接近，但纤维方向不同，所以主要功能也不同。

## 前束
- 主要参与肩关节屈曲（手臂向前抬）和一定程度的内旋。
- 推类动作（卧推、推肩）中参与较多，通常不需要额外大量安排前平举。

## 中束
- 主要参与肩关节外展（手臂向侧面抬），是肩部宽度观感的主要来源。
- 侧平举、绳索侧平举是常见的直接刺激动作。

## 后束
- 主要参与肩关节水平外展和伸展，划船、面拉、反向蝴蝶机都会参与。
- 推类动作多、拉类动作少的人，后束往往参与不足。

## 实践提示
- 三个束常在同一动作中共同参与，只是比例不同，不存在「完全孤立」。
- 肩关节活动度不足时，先降低负荷、缩小幅度，不要硬顶。
- 以上为一般性解剖与训练常识，具体安排需结合个人情况。`,
    exerciseNames: ['哑铃侧平举', '反向蝴蝶机', '坐姿推肩'],
  },
  {
    title: '背阔肌与上背：两种不同的「练背」',
    category: '背',
    body: `## 背阔肌
- 主要功能是肩关节伸展、内收和一定程度的内旋，是垂直拉（下拉、引体）的主要目标。
- 训练时想象「用肘部向下拉」，比单纯用手拉更容易找到发力。

## 上背（斜方肌中下束、菱形肌等）
- 主要参与肩胛骨的后缩、下压与上回旋，水平拉（划船）和面拉更偏这部分。
- 只做下拉容易出现「背阔肌有感觉、上背没感觉」，可以补充划船与面拉。

## 常见误区
- 背阔肌和上背不是同一件事，训练动作的受力方向不同。
- 拉起时耸肩、腰部代偿，会让目标肌肉参与减少。

## 实践提示
- 垂直拉与水平拉都安排，比例可按目标调整。
- 动作幅度优先于重量，尤其是肩胛控制阶段。`,
    exerciseNames: ['正握高位下拉', '坐姿对握划船', '面拉'],
  },
  {
    title: '垂直拉和水平拉的区别',
    category: '背',
    body: `## 方向不同，参与肌肉比例不同
- 垂直拉：阻力方向接近上下，例如高位下拉、引体向上。背阔肌参与较多。
- 水平拉：阻力方向接近前后，例如各种划船。上背、菱形肌、斜方肌中束参与更多。

## 不是替代关系
两者都能练背，但受力方向和关节运动不同，不能简单互相替代。器械被占用时可以临时替换，但长期计划里建议都保留。

## 如何判断是否接近
- 先看动作模式（垂直拉 / 水平拉），再看器械与关节角度。
- 同一肌群但模式不同的动作，通常只能算「部分替代」。

## 实践提示
- 如果当天只有一种器械，优先保证总训练量，而不是执着于某个动作。`,
    exerciseNames: ['正握高位下拉', '坐姿对握划船'],
  },
  {
    title: '胸部推举与飞鸟的区别',
    category: '胸',
    body: `## 推举（多关节）
- 肩、肘同时运动，能使用更大负荷，胸大肌、三角肌前束、肱三头肌共同参与。
- 例子：坐姿推胸、杠铃/哑铃卧推。

## 飞鸟 / 夹胸（单关节为主）
- 以肩关节水平内收为主，肘关节角度基本固定，负荷通常明显小于推举。
- 例子：蝴蝶机夹胸、哑铃飞鸟。

## 关键区别
- 两者负荷不能直接比较，用推举的重量去做夹胸并不合适。
- 飞鸟在拉伸位对肩关节要求更高，活动度不足时不要追求大幅度。

## 实践提示
- 推举作为主要动作，夹胸作为补充，是常见安排。
- 肩部不适时优先减少拉伸幅度，而不是硬撑。`,
    exerciseNames: ['坐姿推胸', '蝴蝶机夹胸', '上斜哑铃卧推'],
  },
  {
    title: '组数、次数与 RIR 的基本概念',
    category: '训练基础',
    body: `## 次数（reps）
- 一次完整的动作往返算 1 次。次数范围影响训练侧重点：偏力量常用较低次数，偏肌肥大常用中等次数，偏耐力常用较高次数。
- 具体范围存在个体差异，不存在唯一正确答案。

## 组数（sets）
- 每个动作完成的轮数。组数是训练量的重要来源，但不是越多越好。
- 新手从较少组数开始，逐步增加，更容易恢复。

## RIR（Reps In Reserve，剩余次数）
- 指一组结束时「还能再做几次」的估计值。RIR 2 表示感觉还能再做 2 次。
- 它是一个主观估计，用来描述接近力竭的程度，不是精确测量。
- 大多数训练不需要每组都练到力竭，保留 1–3 次余力是常见做法。

## 记录的意义
- 记录重量、次数与 RIR，才能判断下一次是否真的进步。
- 以上为一般性训练常识，不构成医疗或康复建议。`,
  },
  {
    title: '渐进超负荷：进步不等于一直加重量',
    category: '训练基础',
    body: `## 什么是渐进超负荷
让训练刺激随着时间逐步提高，身体才有继续适应的理由。加重量只是其中一种方式。

## 常见方式
- 同样重量下增加次数或组数。
- 同样次数下提高重量（幅度通常更小、更慢）。
- 改善动作幅度与控制，让同样的重量做更多有效功。
- 缩短不必要的休息，或提高动作稳定性。

## 实践提示
- 一次只调整一个变量，更容易判断是否有效。
- 进步不是线性的，停滞时先检查睡眠、饮食与恢复，再考虑改计划。
- 不要为了「加重量」牺牲动作质量。`,
  },
  {
    title: '肌肉酸痛与恢复',
    category: '恢复与安全',
    body: `## 延迟性肌肉酸痛（DOMS）
- 常在训练后一段时间出现，可能在 24–72 小时内较明显，之后逐渐缓解。
- 陌生动作、离心成分多、训练量突然增加时更容易出现。
- 酸痛程度不等于训练效果，也不等于没有酸痛就没练到。

## 恢复的基本因素
- 睡眠、总热量与蛋白质摄入、训练量安排，都会影响恢复速度。
- 同一肌群连续高强度训练，恢复往往不足。

## 需要谨慎的情况
- 明显关节疼痛、刺痛、麻木、活动受限，或持续不缓解的疼痛，不属于普通酸痛。
- 这类情况应停止相关动作并寻求专业医疗意见，本应用不提供诊断。

## 待审核
本文为一般性说明，具体恢复安排请结合自身情况。`,
    needsReview: true,
  },
  {
    title: '组间休息时间怎么定',
    category: '训练基础',
    body: `## 大致范围（常见做法，非硬性标准）
- 偏力量：较长休息，约 2–5 分钟，让神经系统恢复。
- 偏肌肥大：中等休息，约 1–3 分钟。
- 偏耐力或小肌群：较短休息，约 30–90 秒。

## 判断标准
- 下一组能否保持动作质量与目标次数，比秒数更重要。
- 呼吸基本平稳、动作不变形，通常可以开始下一组。

## 实践提示
- 复合动作休息更长，孤立动作可以更短。
- 休息过短会明显降低后续组的有效次数，等于变相减少训练量。
- 应用内可在设置里修改默认休息时长，训练页计时条上也能随时调整。`,
  },
];

export const SEED_SUBSTITUTIONS: SeedSubstitution[] = [
  {
    from: '正握高位下拉',
    to: '辅助引体向上',
    similarity: 'close',
    primaryMuscles: ['背阔肌'],
    movementPattern: '垂直拉',
    difference:
      '同为垂直拉。下拉是开链、重量可精细调节；辅助引体是闭链，负荷来自体重与辅助配重，稳定性要求更高。',
    equipment: '高位下拉器 / 辅助引体机',
    caution: '辅助配重越大越省力，先确认能完成目标次数再逐步减少辅助。',
  },
  {
    from: '正握高位下拉',
    to: '坐姿对握划船',
    similarity: 'partial',
    primaryMuscles: ['背阔肌', '上背'],
    movementPattern: '水平拉',
    difference:
      '受力方向从垂直变为水平：背阔肌参与减少，上背与菱形肌参与增加，肘部运动轨迹也不同。',
    equipment: '坐姿划船器',
    caution: '只能作为部分替代，不能长期完全取代垂直拉。',
  },
  {
    from: '坐姿对握划船',
    to: '正握高位下拉',
    similarity: 'partial',
    primaryMuscles: ['背阔肌', '上背'],
    movementPattern: '垂直拉',
    difference: '水平拉换为垂直拉，上背参与减少、背阔肌参与增加，肩胛运动方向不同。',
    equipment: '高位下拉器',
    caution: '如果当天目标是上背，替换后建议补充其他水平拉动作。',
  },
  {
    from: '坐姿推胸',
    to: '蝴蝶机夹胸',
    similarity: 'partial',
    primaryMuscles: ['胸大肌'],
    movementPattern: '肩水平外展',
    difference:
      '推胸是多关节动作，肱三头肌与三角肌前束参与明显；夹胸以肩水平内收为主，负荷通常更小。',
    equipment: '蝴蝶机',
    caution: '两者重量不可直接换算，夹胸不要沿用推胸的重量。',
  },
  {
    from: '哑铃侧平举',
    to: '绳索侧平举',
    similarity: 'close',
    primaryMuscles: ['三角肌中束'],
    movementPattern: '肩外展',
    difference: '同为肩外展。绳索在整个行程中张力更连续，哑铃在底部张力较低。',
    equipment: '哑铃 / 绳索',
    caution: '绳索起始位张力较大，重量应比哑铃更保守。',
  },
  {
    from: '反向蝴蝶机',
    to: '面拉',
    similarity: 'partial',
    primaryMuscles: ['三角肌后束', '上背'],
    movementPattern: '肩水平外展',
    difference: '都涉及后束与上背，但面拉还包含肩胛后缩与外旋，参与肌肉更多，负荷更轻。',
    equipment: '反向蝴蝶机 / 绳索',
    caution: '面拉重量过大容易用腰部代偿，优先保证肩胛控制。',
  },
  {
    from: '仰卧卷腹',
    to: '悬垂举腿',
    similarity: 'partial',
    primaryMuscles: ['腹直肌', '髂腰肌'],
    movementPattern: '核心屈曲',
    difference:
      '卷腹以脊柱屈曲为主、下背贴地；悬垂举腿包含明显髋屈，髂腰肌参与更多，对握力与肩部稳定有要求。',
    equipment: '垫子 / 单杠',
    caution: '悬垂举腿容易摆动借力，控制不住时先做屈膝版本。',
  },
  {
    from: '坐姿推肩',
    to: '哑铃推肩',
    similarity: 'close',
    primaryMuscles: ['三角肌前束', '三角肌中束'],
    movementPattern: '垂直推',
    difference: '同为垂直推。器械轨迹固定、更稳定；哑铃需要更多稳定肌参与，活动范围更自由。',
    equipment: '推肩器 / 哑铃',
    caution: '哑铃推肩对肩关节活动度要求更高，重量先从轻的开始。',
  },
];

function matchExercise(exercises: ExerciseCatalogItem[], name: string): ExerciseCatalogItem | undefined {
  return exercises.find((item) => item.name === name);
}

function buildTemplateExercises(
  exercises: ExerciseCatalogItem[],
  seed: SeedTemplateExercise[],
  templateId: string,
): TemplateExercise[] {
  return seed.map((item, index) => {
    const matched = matchExercise(exercises, item.name);
    return {
      id: `${templateId}-e${index + 1}`,
      exerciseId: matched?.id,
      name: item.name,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      ...(item.restSeconds ? { restSeconds: item.restSeconds } : {}),
      ...(item.note ? { note: item.note } : {}),
    };
  });
}

export function buildSeedTemplates(exercises: ExerciseCatalogItem[]): TrainingTemplate[] {
  const ts = nowISO();
  return SEED_TEMPLATES.map((seed, index) => {
    const id = `builtin-template-${index + 1}`;
    return {
      id,
      name: seed.name,
      targetMuscles: seed.targetMuscles,
      description: seed.description,
      exercises: buildTemplateExercises(exercises, seed.exercises, id),
      isFavorite: index === 0,
      builtin: true,
      createdAt: ts,
      updatedAt: ts,
    };
  });
}

export function buildSeedArticles(exercises: ExerciseCatalogItem[]): KnowledgeArticle[] {
  const ts = nowISO();
  return SEED_ARTICLES.map((seed, index) => {
    const exerciseIds = (seed.exerciseNames ?? [])
      .map((name) => matchExercise(exercises, name)?.id)
      .filter((id): id is string => Boolean(id));
    return {
      id: `builtin-article-${index + 1}`,
      title: seed.title,
      category: seed.category,
      body: seed.body,
      isFavorite: false,
      ...(exerciseIds.length ? { exerciseIds } : {}),
      ...(seed.needsReview ? { needsReview: true } : {}),
      createdAt: ts,
      updatedAt: ts,
    };
  });
}

export function buildSeedSubstitutions(exercises: ExerciseCatalogItem[]): ExerciseSubstitution[] {
  const ts = nowISO();
  const result: ExerciseSubstitution[] = [];
  SEED_SUBSTITUTIONS.forEach((seed, index) => {
    const from = matchExercise(exercises, seed.from);
    const to = matchExercise(exercises, seed.to);
    // 动作库里没有对应动作时跳过，不凭空创建替代关系
    if (!from || !to) return;
    result.push({
      id: `builtin-sub-${index + 1}`,
      fromExerciseId: from.id,
      toExerciseId: to.id,
      similarity: seed.similarity,
      primaryMuscles: seed.primaryMuscles,
      movementPattern: seed.movementPattern,
      difference: seed.difference,
      equipment: seed.equipment,
      caution: seed.caution,
      createdAt: ts,
    });
  });
  return result;
}

/** 名称 -> 分类，用于补齐内置动作库 */
export const SEED_EXTRA_EXERCISE_NAMES = SEED_EXTRA_EXERCISES.map(([name]) => name);

export function createSeedExtraExercises(existingNames: Set<string>): ExerciseCatalogItem[] {
  const ts = nowISO();
  return SEED_EXTRA_EXERCISES.filter(([name]) => !existingNames.has(name)).map(([name, category]) => ({
    id: uid(),
    name,
    category,
    isFavorite: false,
    createdAt: ts,
  }));
}

export { type SeedArticle };
