import type { ExerciseEntry } from '../types';
import { Sheet } from './ui';
import { IconClock } from './Icons';
import { clockLabel, clockLabelSec, durationLabel } from '../lib/date';
import { num, restGapLabel } from '../lib/format';
import { entryStartMs } from '../lib/queries';

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExerciseEntry | null;
}

/** 单个动作的时间明细：开始时间、每组完成时间、相邻组实际间隔 */
export function EntryDetailSheet({ open, onClose, entry }: Props) {
  const sets = entry?.sets ?? [];
  const startMs = entry ? entryStartMs(entry) : null;
  // 旧数据没有 startedAt 时用首组完成时间兜底
  const startIso = entry?.startedAt ?? (startMs !== null ? new Date(startMs).toISOString() : undefined);
  const lastCompletedAt = [...sets].reverse().find((set) => set.completedAt)?.completedAt;
  const lastMs = lastCompletedAt ? Date.parse(lastCompletedAt) : Number.NaN;
  const totalLabel =
    startMs !== null && Number.isFinite(lastMs) && lastMs > startMs
      ? durationLabel(lastMs - startMs)
      : null;
  const totalVolume = sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);

  return (
    <Sheet open={open} onClose={onClose} title={`${entry?.name ?? ''} · 训练详情`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Box label="动作开始" value={clockLabel(startIso) ?? '—'} />
          <Box label="总组数" value={`${sets.length} 组`} />
          <Box label="总次数" value={`${totalReps} 次`} />
        </div>

        <div className="rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-muted">
          <p className="flex items-center gap-1.5">
            <IconClock className="h-3.5 w-3.5" />
            开始 {clockLabel(startIso) ?? '未记录'}
            {lastCompletedAt ? ` · 最后一组 ${clockLabel(lastCompletedAt)}` : ''}
          </p>
          {totalLabel ? <p className="mt-1">这个动作练了约 {totalLabel}</p> : null}
          {totalVolume > 0 ? <p className="mt-1">总容量 {Math.round(totalVolume)} kg</p> : null}
          <p className="mt-1 text-[11px]">
            时间按手机本地时区显示；旧版本记录没有保存完成时间时显示「—」。
          </p>
        </div>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">每组明细</h3>
          {sets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted">
              还没有记录任何一组。
            </p>
          ) : (
            <div className="space-y-1.5">
              {sets.map((set, index) => {
                const gap = restGapLabel(set.completedAt, sets[index - 1]?.completedAt);
                return (
                  <div
                    key={set.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                        set.type === 'warmup' ? 'bg-warn/15 text-warn' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {set.weightKg === 0 ? '自重' : `${num(set.weightKg)} kg`} × {set.reps}
                    </span>
                    <span className="ml-auto text-right text-[11px] leading-tight text-muted">
                      <span className="block">
                        完成 {clockLabelSec(set.completedAt) ?? '—'}
                      </span>
                      {gap ? <span className="block text-[10px]">{gap}</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <div className="text-[14px] font-semibold">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
