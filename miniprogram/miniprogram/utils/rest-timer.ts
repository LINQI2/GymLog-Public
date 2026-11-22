/**
 * 组间休息计时器。
 * 剩余时间 = endAt - Date.now()，只依赖系统时间戳，
 * 切页面、切后台、锁屏回来都不会漂移。
 */
import * as S from './storage';
import { getSettings, saveSettings } from './store';

export type RestStatus = 'idle' | 'running' | 'paused' | 'done';

export interface RestState {
  status: RestStatus;
  endAt: number | null;
  remainingMs: number;
  durationSec: number;
  startedAt: number | null;
  finishedAt: number | null;
}

const INITIAL: RestState = {
  status: 'idle',
  endAt: null,
  remainingMs: 0,
  durationSec: 90,
  startedAt: null,
  finishedAt: null,
};

function loadState(): RestState {
  const stored = S.read<Partial<RestState> | null>(S.K.restTimer, null);
  const settings = getSettings();
  if (!stored) return { ...INITIAL, durationSec: settings.restSeconds };

  const durationSec =
    Number(stored.durationSec) > 0 ? Number(stored.durationSec) : settings.restSeconds;
  const next: RestState = {
    status:
      stored.status === 'running' || stored.status === 'paused' || stored.status === 'done'
        ? stored.status
        : 'idle',
    endAt: typeof stored.endAt === 'number' ? stored.endAt : null,
    remainingMs: typeof stored.remainingMs === 'number' ? Math.max(0, stored.remainingMs) : 0,
    durationSec,
    startedAt: typeof stored.startedAt === 'number' ? stored.startedAt : null,
    finishedAt: typeof stored.finishedAt === 'number' ? stored.finishedAt : null,
  };

  if (next.status === 'running' && next.endAt === null) return { ...INITIAL, durationSec };
  if (next.status === 'running' && next.endAt !== null && next.endAt <= Date.now()) {
    // 关闭期间已经结束
    return { ...next, status: 'done', endAt: null, remainingMs: 0, finishedAt: next.endAt };
  }
  return next;
}

let state: RestState = loadState();
const listeners: Array<(value: RestState) => void> = [];

function persist(): void {
  S.write(S.K.restTimer, state);
}

function emit(): void {
  persist();
  listeners.slice().forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      /* 页面已卸载时忽略 */
    }
  });
}

export function initRestTimer(): void {
  persist();
}

export function subscribe(listener: (value: RestState) => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

export function getState(): RestState {
  return state;
}

export function remainingMs(): number {
  if (state.status === 'running' && state.endAt !== null) {
    return Math.max(0, state.endAt - Date.now());
  }
  if (state.status === 'done') return 0;
  return state.remainingMs;
}

function vibrate(): void {
  const settings = getSettings();
  if (!settings.restVibrate) return;
  try {
    wx.vibrateShort({ type: 'medium' });
    setTimeout(() => {
      try {
        wx.vibrateShort({ type: 'medium' });
      } catch (error) {
        /* 忽略 */
      }
    }, 280);
  } catch (error) {
    /* 部分设备不支持震动 */
  }
}

function finish(): void {
  state = {
    ...state,
    status: 'done',
    endAt: null,
    remainingMs: 0,
    finishedAt: Date.now(),
  };
  emit();
  vibrate();
}

export function tick(): void {
  if (state.status !== 'running' || state.endAt === null) return;
  if (Date.now() >= state.endAt) finish();
}

export function start(seconds?: number): void {
  const duration = Math.max(
    5,
    Math.round(seconds !== undefined ? seconds : getSettings().restSeconds),
  );
  state = {
    status: 'running',
    endAt: Date.now() + duration * 1000,
    remainingMs: duration * 1000,
    durationSec: duration,
    startedAt: Date.now(),
    finishedAt: null,
  };
  emit();
}

export function pause(): void {
  if (state.status !== 'running' || state.endAt === null) return;
  state = {
    ...state,
    status: 'paused',
    endAt: null,
    remainingMs: Math.max(0, state.endAt - Date.now()),
  };
  emit();
}

export function resume(): void {
  if (state.status !== 'paused') return;
  const remaining = state.remainingMs > 0 ? state.remainingMs : state.durationSec * 1000;
  state = { ...state, status: 'running', endAt: Date.now() + remaining, remainingMs: remaining };
  emit();
}

export function restart(): void {
  const duration = state.durationSec > 0 ? state.durationSec : getSettings().restSeconds;
  state = {
    status: 'running',
    endAt: Date.now() + duration * 1000,
    remainingMs: duration * 1000,
    durationSec: duration,
    startedAt: Date.now(),
    finishedAt: null,
  };
  emit();
}

export function skip(): void {
  state = { ...INITIAL, durationSec: getSettings().restSeconds };
  emit();
}

/** 修改默认时长；正在计时时按新时长重新开始 */
export function applyDuration(seconds: number): void {
  const duration = Math.max(5, Math.min(1800, Math.round(seconds)));
  saveSettings({ restSeconds: duration });
  if (state.status === 'idle') {
    state = { ...state, durationSec: duration };
    emit();
    return;
  }
  state = {
    status: 'running',
    endAt: Date.now() + duration * 1000,
    remainingMs: duration * 1000,
    durationSec: duration,
    startedAt: Date.now(),
    finishedAt: null,
  };
  emit();
}

export function formatRest(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
}
