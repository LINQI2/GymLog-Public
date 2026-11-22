export const WEIGHT_MAX = 2000;
export const REPS_MAX = 999;

export interface ParseResult {
  ok: boolean;
  value: number;
  error?: string;
}

/** 解析重量输入：允许 0、小数；禁止负数 / NaN / 过大值 */
export function parseWeight(input: string): ParseResult {
  const raw = input.trim().replace(/[，,]/g, '.').replace(/[kK][gG]$/, '');
  if (raw === '') return { ok: false, value: 0, error: '请输入重量' };
  if (!/^\d*(\.\d*)?$/.test(raw)) return { ok: false, value: 0, error: '重量只能是数字' };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, value: 0, error: '重量不是有效数字' };
  if (value < 0) return { ok: false, value: 0, error: '重量不能为负数' };
  if (value > WEIGHT_MAX) return { ok: false, value: 0, error: `重量不能超过 ${WEIGHT_MAX}kg` };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** 解析次数输入：必须是正整数 */
export function parseReps(input: string): ParseResult {
  const raw = input.trim();
  if (raw === '') return { ok: false, value: 0, error: '请输入次数' };
  if (!/^\d+$/.test(raw)) return { ok: false, value: 0, error: '次数必须是整数' };
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return { ok: false, value: 0, error: '次数必须大于 0' };
  if (value > REPS_MAX) return { ok: false, value: 0, error: `次数不能超过 ${REPS_MAX}` };
  return { ok: true, value };
}

export const NAME_MAX = 24;

/**
 * 规范化动作名称：去掉首尾空白（含中文全角空格），不改动中间内容。
 * 输入法未上屏时可能产生首尾空格，直接 trim 容易出现「少字」错觉。
 */
export function normalizeName(input: string): string {
  return input.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
}

/** 数据约束：写入前的最后一道防线 */
export function isSafeSet(weightKg: number, reps: number): boolean {
  return (
    Number.isFinite(weightKg) &&
    weightKg >= 0 &&
    weightKg <= WEIGHT_MAX &&
    Number.isInteger(reps) &&
    reps > 0 &&
    reps <= REPS_MAX
  );
}
