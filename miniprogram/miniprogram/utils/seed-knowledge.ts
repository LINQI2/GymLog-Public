/**
 * 首次启动写入的示例模板、知识文章与替代关系。
 * 只是可修改的起点：用户可编辑、复制、删除；
 * 表述保持一般性训练常识，不编造研究或教练言论。
 */
import type { ArticleCategory, TrainingTemplate } from './types';
import { nowISO } from './date';
import { createExercise, listExercises } from './store';
import * as S from './storage';
import {
  createSubstitution,
  listArticles,
  listSubstitutions,
  listTemplates,
  saveArticle,
  saveTemplate,
} from './knowledge';

export const META_KNOWLEDGE_SEEDED = 'knowledgeSeeded';

interface TemplateSeed {
  name: string;
  targetMuscles: string;
  description: string;
  exercises: Array<{
    name: string;
    sets: number;
    repMin: number;
    repMax: number;
    restSeconds?: number;
    note?: string;
  }>;
}

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: '肩部训练',
    targetMuscles: '肩 · 三角肌中束 / 前束 / 后束',
    description: '示例结构：先做中束外展，再安排推举，最后补后束。组数和次数只是起点，可按恢复情况调整。',
    exercises: [
      { name: '哑铃侧平举', sets: 3, repMin: 12, repMax: 15, restSeconds: 60, note: '肘部微屈，避免耸肩借力' },
      { name: '坐姿推肩', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '反向蝴蝶机', sets: 3, repMin: 12, repMax: 15, restSeconds: 60, note: '后束主导，重量不必追求大' },
    ],
  },
  {
    name: '背部训练',
    targetMuscles: '背 · 背阔肌 / 上背',
    description: '示例结构：垂直拉为主，配合水平拉。器械被占用时，可以在训练页点「找替代动作」。',
    exercises: [
      { name: '正握高位下拉', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '坐姿对握划船', sets: 4, repMin: 10, repMax: 12, restSeconds: 90 },
      { name: '反握高位下拉', sets: 3, repMin: 10, repMax: 12, restSeconds: 90 },
    ],
  },
  {
    name: '胸部训练',
    targetMuscles: '胸 · 胸大肌',
    description: '示例结构：先做多关节推举，再用夹胸补充。推举与夹胸的负荷不能直接互相比较。',
    exercises: [
      { name: '坐姿推胸', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
      { name: '蝴蝶机夹胸', sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
    ],
  },
  {
    name: '腹部训练',
    targetMuscles: '腹 · 腹直肌 / 深层核心',
    description: '示例结构：屈曲类与抗伸展类搭配。腹部训练不替代全身训练与饮食管理。',
    exercises: [
      { name: '仰卧卷腹', sets: 3, repMin: 15, repMax: 20, restSeconds: 45, note: '下背贴地，用腹肌卷起' },
      { name: '平板支撑', sets: 3, repMin: 30, repMax: 45, restSeconds: 45, note: '按秒计时：每组 30-45 秒' },
    ],
  },
];

interface ArticleSeed {
  title: string;
  category: ArticleCategory;
  body: string;
  exerciseNames?: string[];
  needsReview?: boolean;
}

const ARTICLE_SEEDS: ArticleSeed[] = [
  {
    title: '三角肌前束、中束、后束分别在做什么',
    category: '肩',
    body: `## 三个方向
三角肌分前束、中束、后束，纤维方向不同，主要功能也不同。

## 前束
- 主要参与肩关节屈曲与一定内旋，推类动作里参与较多。
- 推类练得多的人通常不需要额外堆前平举。

## 中束
- 主要参与肩外展（手臂向侧面抬），是肩宽观感的主要来源。
- 哑铃侧平举是常见的直接刺激动作。

## 后束
- 主要参与肩水平外展和伸展，划船、面拉、反向蝴蝶机都会参与。
- 只练推不练拉的人，后束往往参与不足。

## 提示
三个束常在同一动作中共同参与，不存在完全孤立；肩部不适时先降低负荷、缩小幅度。`,
    exerciseNames: ['哑铃侧平举', '反向蝴蝶机', '坐姿推肩'],
  },
  {
    title: '背阔肌与上背：两种不同的练背',
    category: '背',
    body: `## 背阔肌
主要功能是肩关节伸展、内收，是垂直拉（下拉、引体）的主要目标。拉起时想象「用肘部向下拉」。

## 上背
斜方肌中下束、菱形肌等主要参与肩胛骨后缩与下压，水平拉（划船）和面拉更偏这部分。

## 常见问题
- 只做下拉容易出现「背阔肌有感觉、上背没感觉」。
- 拉起时耸肩、腰部代偿，会让目标肌肉参与减少。

## 提示
垂直拉与水平拉都安排，比例按目标调整；动作幅度优先于重量。`,
    exerciseNames: ['正握高位下拉', '坐姿对握划船', '反握高位下拉'],
  },
  {
    title: '垂直拉和水平拉的区别',
    category: '背',
    body: `## 方向不同
- 垂直拉：阻力接近上下，如高位下拉。背阔肌参与较多。
- 水平拉：阻力接近前后，如划船。上背、菱形肌参与更多。

## 不是替代关系
两者都能练背，但受力方向和关节运动不同，不能简单互相替代。临时替换可以，长期计划里建议都保留。

## 怎么判断接近
先看动作模式（垂直拉 / 水平拉），再看器械与关节角度；同一肌群但模式不同，通常只能算「部分替代」。`,
    exerciseNames: ['正握高位下拉', '坐姿对握划船'],
  },
  {
    title: '胸部推举与飞鸟的区别',
    category: '胸',
    body: `## 推举（多关节）
肩、肘同时运动，可用更大负荷，胸大肌、三角肌前束、肱三头肌共同参与。

## 飞鸟 / 夹胸（单关节为主）
以肩关节水平内收为主，肘角基本固定，负荷通常明显更小。

## 关键区别
- 两者负荷不能直接比较，用推举的重量去做夹胸并不合适。
- 夹胸在拉伸位对肩关节要求更高，活动度不足时不要追求大幅度。

## 提示
推举作为主要动作、夹胸作为补充是常见安排；肩部不适时优先减小幅度。`,
    exerciseNames: ['坐姿推胸', '蝴蝶机夹胸'],
  },
  {
    title: '组数、次数与 RIR 的基本概念',
    category: '训练基础',
    body: `## 次数
一次完整往返算 1 次。次数范围影响训练侧重点，存在个体差异，没有唯一答案。

## 组数
每个动作完成的轮数，是训练量的主要来源，但不是越多越好。

## RIR（剩余次数）
一组结束时「还能再做几次」的主观估计。RIR 2 表示感觉还能再做 2 次。
大多数训练不需要每组都力竭，保留 1-3 次余力是常见做法。

## 记录的意义
记录重量、次数与 RIR，才能判断下一次是否真的进步。`,
  },
  {
    title: '渐进超负荷：进步不等于一直加重量',
    category: '训练基础',
    body: `## 什么是渐进超负荷
让训练刺激随时间逐步提高，身体才有继续适应的理由。加重量只是其中一种方式。

## 常见方式
- 同样重量下增加次数或组数。
- 同样次数下小幅提高重量。
- 改善动作幅度与控制，让同样的重量做更多有效功。
- 缩短不必要的休息，或提高稳定性。

## 提示
一次只调整一个变量；进步不是线性的，停滞时先检查睡眠、饮食与恢复。`,
  },
  {
    title: '肌肉酸痛与恢复',
    category: '恢复与安全',
    body: `## 延迟性肌肉酸痛
常在训练后一段时间出现，可能持续 1-3 天。陌生动作、离心成分多、训练量突然增加时更容易出现。
酸痛程度不等于训练效果。

## 恢复的基本因素
睡眠、总热量与蛋白质摄入、训练量安排都会影响恢复速度。

## 需要谨慎的情况
明显关节疼痛、刺痛、麻木、活动受限，或持续不缓解的疼痛，不属于普通酸痛。
这类情况应停止相关动作并寻求专业医疗意见，本应用不提供诊断。`,
    needsReview: true,
  },
  {
    title: '组间休息时间怎么定',
    category: '训练基础',
    body: `## 大致范围（常见做法，非硬性标准）
- 偏力量：约 2-5 分钟。
- 偏肌肥大：约 1-3 分钟。
- 偏耐力或小肌群：约 30-90 秒。

## 判断标准
下一组能否保持动作质量与目标次数，比秒数更重要。

## 提示
复合动作休息更长，孤立动作可以更短；休息过短会明显降低后续组的有效次数。
可以在「设置」里改默认时长，训练页的计时条上也能随时调整。`,
  },
];

interface SubSeed {
  from: string;
  to: string;
  similarity: 'close' | 'partial';
  primaryMuscles: string[];
  movementPattern: string;
  difference: string;
  equipment: string;
  caution: string;
}

const SUB_SEEDS: SubSeed[] = [
  {
    from: '正握高位下拉',
    to: '反握高位下拉',
    similarity: 'close',
    primaryMuscles: ['背阔肌'],
    movementPattern: '垂直拉',
    difference: '同为垂直拉，握法不同：反握对肱二头肌参与略多，肩关节伸展角度略有差异。',
    equipment: '高位下拉器',
    caution: '反握时手腕压力更大，握不住可以换回正握。',
  },
  {
    from: '正握高位下拉',
    to: '坐姿对握划船',
    similarity: 'partial',
    primaryMuscles: ['背阔肌', '上背'],
    movementPattern: '水平拉',
    difference: '受力方向从垂直变为水平：背阔肌参与减少，上背与菱形肌参与增加。',
    equipment: '坐姿划船器',
    caution: '只能作为部分替代，不要长期完全取代垂直拉。',
  },
  {
    from: '正握高位下拉',
    to: '窄对握高位下拉',
    similarity: 'close',
    primaryMuscles: ['背阔肌'],
    movementPattern: '垂直拉',
    difference: '握距更窄，动作幅度略长，肱二头肌参与稍多，整体模式一致。',
    equipment: '高位下拉器',
    caution: '窄握时肩前侧不适就换回常规握距。',
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
    difference: '推胸是多关节动作，肱三头肌与三角肌前束参与明显；夹胸以肩水平内收为主，负荷通常更小。',
    equipment: '蝴蝶机',
    caution: '两者重量不可直接换算，夹胸不要沿用推胸的重量。',
  },
  {
    from: '反向蝴蝶机',
    to: '坐姿对握划船',
    similarity: 'partial',
    primaryMuscles: ['三角肌后束', '上背'],
    movementPattern: '水平拉',
    difference: '反向蝴蝶机以后束为主、肘部固定；划船包含肘屈与更多上背参与。',
    equipment: '反向蝴蝶机 / 划船器',
    caution: '划船重量通常更大，不能用来判断后束训练量。',
  },
];

function findByName(name: string) {
  return listExercises().find((item) => item.name === name);
}

export function ensureKnowledgeSeed(): void {
  if (S.read<boolean>(S.K.meta(META_KNOWLEDGE_SEEDED), false)) return;

  // 腹部模板需要平板支撑，缺失时补一个
  if (!findByName('平板支撑')) createExercise('平板支撑', '腹');

  const ts = nowISO();

  if (listTemplates().length === 0) {
    TEMPLATE_SEEDS.forEach((seed, index) => {
      const id = `builtin-template-${index + 1}`;
      const template: TrainingTemplate = {
        id,
        name: seed.name,
        targetMuscles: seed.targetMuscles,
        description: seed.description,
        exercises: seed.exercises.map((item, itemIndex) => {
          const matched = findByName(item.name);
          return {
            id: `${id}-e${itemIndex + 1}`,
            ...(matched ? { exerciseId: matched.id } : {}),
            name: item.name,
            sets: item.sets,
            repMin: item.repMin,
            repMax: item.repMax,
            ...(item.restSeconds ? { restSeconds: item.restSeconds } : {}),
            ...(item.note ? { note: item.note } : {}),
          };
        }),
        isFavorite: index === 0,
        builtin: true,
        createdAt: ts,
        updatedAt: ts,
      };
      saveTemplate(template);
    });
  }

  if (listArticles().length === 0) {
    ARTICLE_SEEDS.forEach((seed, index) => {
      const exerciseIds = (seed.exerciseNames || [])
        .map((name) => findByName(name)?.id)
        .filter((id): id is string => Boolean(id));
      saveArticle({
        id: `builtin-article-${index + 1}`,
        title: seed.title,
        category: seed.category,
        body: seed.body,
        ...(exerciseIds.length ? { exerciseIds } : {}),
        isFavorite: false,
        ...(seed.needsReview ? { needsReview: true } : {}),
        createdAt: ts,
        updatedAt: ts,
      });
    });
  }

  if (listSubstitutions().length === 0) {
    SUB_SEEDS.forEach((seed) => {
      const from = findByName(seed.from);
      const to = findByName(seed.to);
      if (!from || !to) return;
      createSubstitution({
        fromExerciseId: from.id,
        toExerciseId: to.id,
        similarity: seed.similarity,
        difference: seed.difference,
        primaryMuscles: seed.primaryMuscles,
        movementPattern: seed.movementPattern,
        equipment: seed.equipment,
        caution: seed.caution,
      });
    });
  }

  S.write(S.K.meta(META_KNOWLEDGE_SEEDED), true);
}
