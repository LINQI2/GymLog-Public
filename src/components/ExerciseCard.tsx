import { useState } from 'react';
import type { ExerciseEntry, SetEntry } from '../types';
import { num, restGapLabel } from '../lib/format';
import { parseReps, parseWeight } from '../lib/validation';
import { clockLabelSec, humanDate } from '../lib/date';
import { IconBook, IconClock, IconMinus, IconPlus, IconStar, IconTrash } from './Icons';

interface CardProps {
  entry: ExerciseEntry;
  lastRecord: { date: string; entry: ExerciseEntry } | null;
  expandedSetId: string | null;
  isFavorite: boolean | null;
  onToggleSet: (setId: string | null) => void;
  onAddSet: () => void;
  onUpdateSet: (setId: string, patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>) => void;
  onDeleteSet: (setId: string) => void;
  onRequestDelete: () => void;
  onRequestRename: () => void;
  onToggleFavorite: (() => void) | null;
  /** 查看动作简介与教学链接 */
  onOpenInfo: () => void;
  /** 是否有已保存的学习资料（用于按钮高亮） */
  hasInfo: boolean;
  /** 查看该动作的开始时间与每组完成时间 */
  onOpenDetail: () => void;
  /** 找替代动作（器械被占用 / 不适合自己时） */
  onOpenSubstitution: () => void;
}

export function ExerciseCard({
  entry,
  lastRecord,
  expandedSetId,
  isFavorite,
  onToggleSet,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onRequestDelete,
  onRequestRename,
  onToggleFavorite,
  onOpenInfo,
  hasInfo,
  onOpenDetail,
  onOpenSubstitution,
}: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const totalSets = entry.sets.length;
  const totalReps = entry.sets.reduce((sum, s) => sum + s.reps, 0);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-2 px-4 pb-1 pt-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold leading-tight">{entry.name}</h3>
          {entry.target ? (
            <p className="mt-0.5 text-[11px] font-medium text-accent">
              目标 {entry.target.sets} 组 ×{' '}
              {entry.target.repMin === entry.target.repMax
                ? entry.target.repMin
                : `${entry.target.repMin}–${entry.target.repMax}`}{' '}
              次
            </p>
          ) : null}
          {lastRecord ? (
            <p className="mt-1 truncate text-[11px] text-muted">
              上次 {humanDate(lastRecord.date)}：
              {lastRecord.entry.sets.map((s) => `${s.weightKg === 0 ? '自重' : num(s.weightKg)}×${s.reps}`).join('  ')}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted">首次记录这个动作</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="查看教学"
          className={`tap flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ${
            hasInfo ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'
          }`}
        >
          <IconBook className="h-3.5 w-3.5" />
          教学
        </button>
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label="收藏"
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted"
          >
            <IconStar filled={isFavorite === true} className={`h-4 w-4 ${isFavorite ? 'text-warn' : ''}`} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="更多操作"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted"
        >
          <span className="text-lg leading-none">⋯</span>
        </button>
      </header>

      {menuOpen ? (
        <div className="mx-4 mb-1 space-y-2 rounded-xl bg-surface-2 p-2 text-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenDetail();
              }}
              className="tap flex-1 rounded-lg bg-surface py-2 font-medium"
            >
              训练详情
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenSubstitution();
              }}
              className="tap flex-1 rounded-lg bg-surface py-2 font-medium text-accent"
            >
              找替代动作
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestRename();
              }}
              className="tap flex-1 rounded-lg bg-surface py-2 font-medium"
            >
              重命名
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestDelete();
              }}
              className="tap flex-1 rounded-lg py-2 font-medium text-danger"
            >
              删除动作
            </button>
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-line px-2 py-1">
        {entry.sets.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-muted">还没有记录，点下面的按钮记录第一组。</p>
        ) : (
          entry.sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              index={index}
              gap={restGapLabel(set.completedAt, entry.sets[index - 1]?.completedAt)}
              expanded={expandedSetId === set.id}
              onToggle={() => onToggleSet(expandedSetId === set.id ? null : set.id)}
              onUpdate={(patch) => onUpdateSet(set.id, patch)}
              onDelete={() => onDeleteSet(set.id)}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={onAddSet}
          className="tap flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
        >
          <IconPlus className="h-5 w-5" />
          记录一组
        </button>
        {totalSets > 0 ? (
          <div className="shrink-0 rounded-xl bg-surface-2 px-3 py-2 text-center text-[11px] leading-tight text-muted">
            <div className="font-semibold text-ink">{totalSets} 组</div>
            <div>{totalReps} 次</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SetRow({
  set,
  index,
  gap,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  set: SetEntry;
  index: number;
  /** 与上一组的实际间隔，旧数据没有 completedAt 时为 null */
  gap: string | null;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>) => void;
  onDelete: () => void;
}) {
  const volume = set.weightKg * set.reps;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`tap flex w-full items-center gap-2.5 rounded-xl px-2.5 py-3 text-left ${
          expanded ? 'bg-accent-soft' : 'active:bg-surface-2'
        }`}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
            set.type === 'warmup' ? 'bg-warn/15 text-warn' : 'bg-surface-2 text-muted'
          }`}
        >
          {index + 1}
        </span>
        <span className="text-[15px] font-semibold">
          {set.weightKg === 0 ? '自重' : `${num(set.weightKg)} kg`}
        </span>
        <span className="text-muted">×</span>
        <span className="text-[15px] font-semibold">{set.reps}</span>
        <span className="text-[13px] text-muted">次</span>
        {set.type === 'warmup' ? (
          <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn">
            热身
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-right leading-tight">
          <span className="block text-xs text-muted">{volume > 0 ? `${Math.round(volume)} kg` : '—'}</span>
          {gap ? <span className="block text-[10px] text-muted/80">{gap}</span> : null}
        </span>
      </button>
      {expanded ? <SetEditor set={set} gap={gap} onUpdate={onUpdate} onDelete={onDelete} /> : null}
    </div>
  );
}

function SetEditor({
  set,
  gap,
  onUpdate,
  onDelete,
}: {
  set: SetEntry;
  gap: string | null;
  onUpdate: (patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>) => void;
  onDelete: () => void;
}) {
  const [weightText, setWeightText] = useState(num(set.weightKg));
  const [repsText, setRepsText] = useState(String(set.reps));
  const [error, setError] = useState<string | null>(null);

  const handleWeight = (text: string) => {
    setWeightText(text);
    const parsed = parseWeight(text);
    if (!parsed.ok) {
      setError(parsed.error ?? '重量无效');
      return;
    }
    setError(null);
    onUpdate({ weightKg: parsed.value });
  };

  const handleReps = (text: string) => {
    setRepsText(text);
    const parsed = parseReps(text);
    if (!parsed.ok) {
      setError(parsed.error ?? '次数无效');
      return;
    }
    setError(null);
    onUpdate({ reps: parsed.value });
  };

  const stepWeight = (delta: number) => {
    const parsed = parseWeight(weightText);
    const base = parsed.ok ? parsed.value : set.weightKg;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setWeightText(num(next));
    setError(null);
    onUpdate({ weightKg: next });
  };

  const stepReps = (delta: number) => {
    const parsed = parseReps(repsText);
    const base = parsed.ok ? parsed.value : set.reps;
    const next = Math.max(1, base + delta);
    setRepsText(String(next));
    setError(null);
    onUpdate({ reps: next });
  };

  return (
    <div className="surface-2 mx-1 mb-2 rounded-xl p-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs text-muted">重量</span>
          <button
            type="button"
            onClick={() => stepWeight(-0.5)}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface"
            aria-label="减少0.5公斤"
          >
            <IconMinus className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-line bg-surface px-2">
            <input
              value={weightText}
              onChange={(event) => handleWeight(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              inputMode="decimal"
              type="text"
              pattern="[0-9.]*"
              aria-label="重量（公斤）"
              className="w-full bg-transparent py-2.5 text-center text-[17px] font-semibold outline-none"
            />
            <span className="shrink-0 pr-1 text-xs text-muted">kg</span>
          </div>
          <button
            type="button"
            onClick={() => stepWeight(0.5)}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface"
            aria-label="增加0.5公斤"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs text-muted">次数</span>
          <button
            type="button"
            onClick={() => stepReps(-1)}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface"
            aria-label="减少1次"
          >
            <IconMinus className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-line bg-surface px-2">
            <input
              value={repsText}
              onChange={(event) => handleReps(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              inputMode="numeric"
              type="text"
              pattern="[0-9]*"
              aria-label="次数"
              className="w-full bg-transparent py-2.5 text-center text-[17px] font-semibold outline-none"
            />
            <span className="shrink-0 pr-1 text-xs text-muted">次</span>
          </div>
          <button
            type="button"
            onClick={() => stepReps(1)}
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface"
            aria-label="增加1次"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" />
          完成于 {clockLabelSec(set.completedAt) ?? '—'}
        </span>
        {gap ? <span>· {gap}</span> : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onUpdate({ type: set.type === 'warmup' ? 'normal' : 'warmup' })}
          className={`tap rounded-lg border px-3 py-2 text-xs font-medium ${
            set.type === 'warmup'
              ? 'border-warn bg-warn/15 text-warn'
              : 'border-line bg-surface text-muted'
          }`}
        >
          热身组
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="tap ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-danger"
        >
          <IconTrash className="h-4 w-4" />
          删除该组
        </button>
      </div>
    </div>
  );
}
