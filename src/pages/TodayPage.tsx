import { useRef, useState } from 'react';
import { useGymLog, useToday } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { addDays, humanDate, relativeDayLabel, todayISO } from '../lib/date';
import { IconChevronLeft, IconChevronRight, IconMoon, IconSun } from '../components/Icons';

export function TodayPage() {
  const today = useToday();
  const { settings, setTheme } = useGymLog();
  const [selected, setSelected] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const date = selected ?? today;
  const relative = relativeDayLabel(date, today);
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <>
      <PageHeader
        title="今日训练"
        subtitle={relative ? `${relative} · ${humanDate(date)}` : humanDate(date)}
        right={
          <button
            type="button"
            aria-label="切换深色模式"
            onClick={() => void setTheme(isDark ? 'light' : 'dark')}
            className="tap grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
          >
            {isDark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="card flex items-center gap-1 p-1.5">
          <button
            type="button"
            aria-label="前一天"
            onClick={() => setSelected(addDays(date, -1))}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted active:bg-surface-2"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>

          <label className="relative flex min-w-0 flex-1 flex-col items-center justify-center py-1">
            <span className="text-[15px] font-semibold">{humanDate(date)}</span>
            <span className="text-[11px] text-muted">
              {relative ?? `${date.split('-')[0]}年 · 点击选择日期`}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              max="2100-12-31"
              onChange={(event) => {
                if (event.target.value) setSelected(event.target.value);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="选择日期"
            />
          </label>

          <button
            type="button"
            aria-label="后一天"
            onClick={() => setSelected(addDays(date, 1))}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted active:bg-surface-2"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </div>

        {date !== todayISO() ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="tap mt-2 w-full rounded-xl border border-line bg-surface py-2 text-xs font-medium text-muted"
          >
            回到今天
          </button>
        ) : null}
      </div>

      <WorkoutEditor date={date} />
    </>
  );
}
