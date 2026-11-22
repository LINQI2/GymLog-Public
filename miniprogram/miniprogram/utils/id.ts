let counter = 0;

/** 简单可读的唯一 ID（小程序单端使用，无需 UUID 级别强度） */
export function uid(): string {
  counter = (counter + 1) % 100000;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
