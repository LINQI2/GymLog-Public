import type { ExerciseCategory } from '../types';
import { uid } from './id';
import { nowISO } from './date';
import type { ExerciseCatalogItem } from '../types';

/** 内置动作（首次使用时写入动作库） */
export const DEFAULT_EXERCISES: Array<[string, ExerciseCategory]> = [
  ['蝴蝶机夹胸', '胸'],
  ['坐姿推胸', '胸'],
  ['正握高位下拉', '背'],
  ['反握高位下拉', '背'],
  ['窄对握高位下拉', '背'],
  ['坐姿对握划船', '背'],
  ['坐姿推肩', '肩'],
  ['哑铃侧平举', '肩'],
  ['反向蝴蝶机', '肩'],
  ['哑铃弯举', '手臂'],
  ['仰卧卷腹', '腹'],
];

export function createDefaultExercises(): ExerciseCatalogItem[] {
  const ts = nowISO();
  return DEFAULT_EXERCISES.map(([name, category], index) => ({
    id: uid(),
    name,
    category,
    isFavorite: index < 4,
    createdAt: ts,
  }));
}
