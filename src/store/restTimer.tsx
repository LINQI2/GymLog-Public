/**
 * 组间休息计时器。
 *
 * 关键点：剩余时间一律用「系统时间戳 - 当前时间」计算，不靠累加 tick，
 * 因此切页面、切后台、锁屏回来都不会漂移。
 * 运行状态额外写入 localStorage，WebView 被系统回收后重开也能还原。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { REST_SECONDS_DEFAULT, useGymLog } from './gymlog';

const STORAGE_KEY = 'gymlog.restTimer.v1';
/** 结束提示保留这么久后自动收起，避免一直占着屏幕 */
const DONE_VISIBLE_MS = 30_000;

export type RestStatus = 'idle' | 'running' | 'paused' | 'done';

interface PersistedState {
  status: RestStatus;
  /** 运行中：目标结束时间戳（ms） */
  endAt: number | null;
  /** 暂停/结束时：剩余毫秒 */
  remainingMs: number;
  durationSec: number;
  startedAt: number | null;
  finishedAt: number | null;
}

const INITIAL: PersistedState = {
  status: 'idle',
  endAt: null,
  remainingMs: 0,
  durationSec: REST_SECONDS_DEFAULT,
  startedAt: null,
  finishedAt: null,
};

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const durationSec =
      typeof parsed.durationSec === 'number' && parsed.durationSec > 0
        ? parsed.durationSec
        : REST_SECONDS_DEFAULT;
    const state: PersistedState = {
      status: parsed.status === 'running' || parsed.status === 'paused' || parsed.status === 'done'
        ? parsed.status
        : 'idle',
      endAt: typeof parsed.endAt === 'number' ? parsed.endAt : null,
      remainingMs: typeof parsed.remainingMs === 'number' ? Math.max(0, parsed.remainingMs) : 0,
      durationSec,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      finishedAt: typeof parsed.finishedAt === 'number' ? parsed.finishedAt : null,
    };
    if (state.status === 'running' && state.endAt !== null && state.endAt <= Date.now()) {
      // 关闭期间已经结束：直接进入「休息结束」状态
      return {
        ...state,
        status: 'done',
        endAt: null,
        remainingMs: 0,
        finishedAt: state.endAt,
      };
    }
    if (state.status === 'running' && state.endAt === null) return INITIAL;
    return state;
  } catch {
    return INITIAL;
  }
}

function persist(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 存储被禁用时忽略：计时仍然在当前会话内可用 */
  }
}

/* ---------- 提示音（WebAudio，无需额外插件与音频文件） ---------- */
let audioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

/** 在用户手势中调用一次，尽量解锁音频，之后倒计时结束才能出声 */
export function primeRestAudio(): void {
  ensureAudioContext();
}

function playChime(): void {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + 0.02;
    [0, 0.3].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = index === 0 ? 880 : 1174;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.3);
    });
  } catch {
    /* 音频被系统拦截时静默 */
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([220, 120, 220]);
  } catch {
    /* 没有震动权限时静默 */
  }
}

export interface RestTimerValue {
  status: RestStatus;
  /** 剩余毫秒（运行中实时刷新） */
  remainingMs: number;
  durationSec: number;
  /** 本轮总时长（毫秒），用于进度条 */
  totalMs: number;
  start: (seconds?: number) => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  skip: () => void;
  extend: (seconds: number) => void;
  /** 修改默认时长；正在计时时按新时长重新开始 */
  applyDuration: (seconds: number) => void;
}

const RestTimerContext = createContext<RestTimerValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useGymLog();
  const [state, setState] = useState<PersistedState>(loadPersisted);
  const [now, setNow] = useState(() => Date.now());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const apply = useCallback((next: PersistedState) => {
    persist(next);
    setState(next);
  }, []);

  const finish = useCallback(() => {
    apply({
      status: 'done',
      endAt: null,
      remainingMs: 0,
      durationSec: settingsRef.current.restSeconds,
      startedAt: null,
      finishedAt: Date.now(),
    });
    if (settingsRef.current.restVibrate) vibrate();
    if (settingsRef.current.restSound) playChime();
  }, [apply]);

  /* ---------- 心跳：只用时间戳计算，无需累加 ---------- */
  useEffect(() => {
    if (state.status !== 'running') return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const endAt = state.endAt;
      if (endAt !== null && current >= endAt) {
        finish();
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    // 回到前台时立即校准一次（interval 在后台会被系统节流）
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.endAt, finish]);

  /* 结束提示自动收起 */
  useEffect(() => {
    if (state.status !== 'done') return;
    const timer = window.setTimeout(() => {
      apply(INITIAL);
    }, DONE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, apply]);

  const start = useCallback(
    (seconds?: number) => {
      const durationSec = Math.max(1, Math.round(seconds ?? settingsRef.current.restSeconds));
      const startedAt = Date.now();
      primeRestAudio();
      apply({
        status: 'running',
        endAt: startedAt + durationSec * 1000,
        remainingMs: durationSec * 1000,
        durationSec,
        startedAt,
        finishedAt: null,
      });
      setNow(startedAt);
    },
    [apply],
  );

  const pause = useCallback(() => {
    setState((current) => {
      if (current.status !== 'running' || current.endAt === null) return current;
      const remainingMs = Math.max(0, current.endAt - Date.now());
      const next: PersistedState = {
        ...current,
        status: 'paused',
        endAt: null,
        remainingMs,
      };
      persist(next);
      return next;
    });
  }, []);

  const resume = useCallback(() => {
    setState((current) => {
      if (current.status !== 'paused') return current;
      const remainingMs = current.remainingMs > 0 ? current.remainingMs : current.durationSec * 1000;
      const next: PersistedState = {
        ...current,
        status: 'running',
        endAt: Date.now() + remainingMs,
        remainingMs,
      };
      persist(next);
      return next;
    });
    primeRestAudio();
  }, []);

  const restart = useCallback(() => {
    setState((current) => {
      const durationSec =
        current.durationSec > 0 ? current.durationSec : settingsRef.current.restSeconds;
      const next: PersistedState = {
        status: 'running',
        endAt: Date.now() + durationSec * 1000,
        remainingMs: durationSec * 1000,
        durationSec,
        startedAt: Date.now(),
        finishedAt: null,
      };
      persist(next);
      return next;
    });
    primeRestAudio();
  }, []);

  const skip = useCallback(() => {
    apply(INITIAL);
  }, [apply]);

  const extend = useCallback((seconds: number) => {
    setState((current) => {
      if (current.status === 'idle') return current;
      if (current.status === 'running' && current.endAt !== null) {
        const next: PersistedState = {
          ...current,
          endAt: current.endAt + seconds * 1000,
          durationSec: current.durationSec + seconds,
        };
        persist(next);
        return next;
      }
      if (current.status === 'done') {
        const next: PersistedState = {
          status: 'running',
          endAt: Date.now() + seconds * 1000,
          remainingMs: seconds * 1000,
          durationSec: seconds,
          startedAt: Date.now(),
          finishedAt: null,
        };
        persist(next);
        return next;
      }
      const remainingMs = Math.max(1000, current.remainingMs + seconds * 1000);
      const next: PersistedState = {
        ...current,
        remainingMs,
        durationSec: Math.round(remainingMs / 1000),
      };
      persist(next);
      return next;
    });
  }, []);

  const applyDuration = useCallback(
    (seconds: number) => {
      const durationSec = Math.max(1, Math.round(seconds));
      void updateSettings({ restSeconds: durationSec });
      setState((current) => {
        if (current.status === 'idle') return { ...current, durationSec };
        const next: PersistedState = {
          status: 'running',
          endAt: Date.now() + durationSec * 1000,
          remainingMs: durationSec * 1000,
          durationSec,
          startedAt: Date.now(),
          finishedAt: null,
        };
        persist(next);
        return next;
      });
    },
    [updateSettings],
  );

  const remainingMs = useMemo(() => {
    if (state.status === 'running' && state.endAt !== null) {
      return Math.max(0, state.endAt - now);
    }
    if (state.status === 'done') return 0;
    return state.remainingMs;
  }, [state.status, state.endAt, state.remainingMs, now]);

  const value: RestTimerValue = {
    status: state.status,
    remainingMs,
    durationSec: state.durationSec || settings.restSeconds,
    totalMs: (state.durationSec || settings.restSeconds) * 1000,
    start,
    pause,
    resume,
    restart,
    skip,
    extend,
    applyDuration,
  };

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer 必须在 RestTimerProvider 内部使用');
  return ctx;
}

/** mm:ss */
export function formatRest(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
