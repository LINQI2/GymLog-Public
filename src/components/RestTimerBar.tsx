import { useState } from 'react';
import { formatRest, useRestTimer } from '../store/restTimer';
import { Sheet } from './ui';
import { useToast } from './Toast';
import {
  IconPause,
  IconPlay,
  IconRefresh,
  IconSkip,
  IconTimer,
} from './Icons';
import { REST_SECONDS_MAX, REST_SECONDS_MIN } from '../store/gymlog';

const QUICK_SECONDS = [60, 90, 120, 180];

/**
 * 悬浮在底部导航上方的休息计时条。
 * 位置固定在 nav 之上，不覆盖「记录一组」等按钮；
 * 显示时会同步撑高页面底部留白（见 Layout）。
 */
export function RestTimerBar() {
  const timer = useRestTimer();
  const { showToast } = useToast();
  const [durationOpen, setDurationOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  if (timer.status === 'idle') return null;

  const done = timer.status === 'done';
  const running = timer.status === 'running';
  const percent = timer.totalMs > 0 ? Math.min(100, Math.max(0, (timer.remainingMs / timer.totalMs) * 100)) : 0;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] z-40 px-3">
        <div className="pointer-events-auto mx-auto w-full max-w-[524px]">
          <div
            className={`relative overflow-hidden rounded-2xl border bg-surface/97 shadow-xl backdrop-blur-md ${
              done ? 'border-accent' : 'border-line'
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-surface-2">
              <div
                className="h-full bg-accent transition-[width] duration-200 ease-linear"
                style={{ width: `${done ? 100 : percent}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCustomText(String(timer.durationSec));
                  setDurationOpen(true);
                }}
                aria-label="调整休息时长"
                className="tap flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <IconTimer className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[19px] font-bold leading-none tabular-nums">
                    {done ? '00:00' : formatRest(timer.remainingMs)}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[10px] leading-tight ${
                      done ? 'font-semibold text-accent' : 'text-muted'
                    }`}
                  >
                    {done ? '休息结束，可以开始下一组' : running ? '休息中 · 点数字改时长' : '已暂停'}
                  </span>
                </span>
              </button>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (running) timer.pause();
                    else if (done) timer.restart();
                    else timer.resume();
                  }}
                  aria-label={running ? '暂停休息' : done ? '重新开始' : '继续休息'}
                  className="tap grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink"
                >
                  {running ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => timer.restart()}
                  aria-label="重新开始计时"
                  className="tap grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted"
                >
                  <IconRefresh className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    timer.skip();
                    showToast('已跳过休息');
                  }}
                  aria-label="跳过休息"
                  className="tap grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted"
                >
                  <IconSkip className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={durationOpen} onClose={() => setDurationOpen(false)} title="休息时长">
        <div className="flex flex-wrap gap-2">
          {QUICK_SECONDS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              onClick={() => {
                timer.applyDuration(seconds);
                setDurationOpen(false);
                showToast(`休息 ${seconds} 秒，已重新计时`);
              }}
              className={`tap rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                timer.durationSec === seconds
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface-2 text-ink'
              }`}
            >
              {seconds >= 60 ? `${seconds / 60} 分钟` : `${seconds} 秒`}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted" htmlFor="rest-custom">
            自定义（{REST_SECONDS_MIN}–{REST_SECONDS_MAX} 秒）
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="rest-custom"
              value={customText}
              onChange={(event) => setCustomText(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              type="text"
              pattern="[0-9]*"
              placeholder="例如 75"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] outline-none focus:border-accent"
            />
            <span className="shrink-0 text-xs text-muted">秒</span>
            <button
              type="button"
              onClick={() => {
                const value = Number(customText);
                if (!Number.isFinite(value) || value <= 0) {
                  showToast('请输入有效的秒数');
                  return;
                }
                const seconds = Math.min(REST_SECONDS_MAX, Math.max(REST_SECONDS_MIN, Math.round(value)));
                timer.applyDuration(seconds);
                setDurationOpen(false);
                showToast(`休息 ${seconds} 秒，已重新计时`);
              }}
              className="tap shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
            >
              确定
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            选择的时长会保存为默认值，下次「记录一组」后自动使用。
          </p>
        </div>
      </Sheet>
    </>
  );
}
