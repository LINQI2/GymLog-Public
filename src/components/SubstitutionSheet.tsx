import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { Sheet } from './ui';
import { IconArrowRight, IconInfo } from './Icons';
import { linkTitle, openExternalUrl } from '../lib/links';
import type { ExerciseCatalogItem, ExerciseSubstitution } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 原动作：有 id 用 id，否则按名称匹配 */
  from: { id?: string; name: string } | null;
  /** 训练页 / 模板页传入；知识页查看时不传 */
  onApply?: (target: ExerciseCatalogItem, mode: 'replace' | 'add') => void;
  /** 原动作是否已经记录了完成的组（有则默认只允许追加，不替换） */
  hasCompletedSets?: boolean;
  /** 是否允许「同时添加」；模板里替换动作时只需要替换 */
  allowAdd?: boolean;
}

function similarityLabel(value: ExerciseSubstitution['similarity']): string {
  return value === 'close' ? '较接近' : '部分替代';
}

export function SubstitutionSheet({
  open,
  onClose,
  from,
  onApply,
  hasCompletedSets = false,
  allowAdd = true,
}: Props) {
  const { exercises, substitutions } = useGymLog();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fromExercise = useMemo(() => {
    if (!from) return undefined;
    if (from.id) return exercises.find((item) => item.id === from.id);
    return exercises.find((item) => item.name === from.name);
  }, [exercises, from]);

  const rows = useMemo(() => {
    if (!fromExercise) return [];
    return substitutions
      .filter((item) => item.fromExerciseId === fromExercise.id)
      .map((item) => ({
        substitution: item,
        target: exercises.find((exercise) => exercise.id === item.toExerciseId),
      }))
      .filter(
        (row): row is { substitution: ExerciseSubstitution; target: ExerciseCatalogItem } =>
          Boolean(row.target),
      );
  }, [substitutions, exercises, fromExercise]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(rows[0]?.target.id ?? null);
  }, [open, rows]);

  const selected = rows.find((row) => row.target.id === selectedId) ?? rows[0] ?? null;

  const apply = (mode: 'replace' | 'add') => {
    if (!selected || !onApply) return;
    onApply(selected.target, mode);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${from?.name ?? ''} · 替代动作`}
      footer={
        onApply && selected ? (
          hasCompletedSets ? (
            <button
              type="button"
              onClick={() => apply('add')}
              className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
            >
              保留原动作并添加「{selected.target.name}」
            </button>
          ) : allowAdd ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => apply('add')}
                className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted"
              >
                同时添加
              </button>
              <button
                type="button"
                onClick={() => apply('replace')}
                className="tap flex-[1.3] rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
              >
                替换为「{selected.target.name}」
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => apply('replace')}
              className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
            >
              替换为「{selected.target.name}」
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="tap w-full rounded-xl bg-surface-2 py-3 text-sm font-semibold text-muted"
          >
            关闭
          </button>
        )
      }
    >
      {!fromExercise ? (
        <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">
          「{from?.name}」还没有对应的动作库条目，无法建立替代关系。可以先在「动作」页创建这个动作，再到「知识 → 动作替代」里补充。
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">
          <p>还没有为「{fromExercise.name}」设置替代动作。</p>
          <p className="mt-1">可以在「知识 → 动作替代」里添加，全部保存在本机，不需要联网。</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 rounded-xl bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
            <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            替代动作只是临时选择，训练量、组数与次数仍需按自己的情况调整。同一肌群不等同于完全等效。
          </p>

          {rows.map(({ substitution, target }) => {
            const active = selected?.target.id === target.id;
            return (
              <button
                key={substitution.id}
                type="button"
                onClick={() => setSelectedId(target.id)}
                className={`tap w-full rounded-xl border p-3 text-left ${
                  active ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{target.name}</span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      substitution.similarity === 'close'
                        ? 'bg-accent-soft text-accent'
                        : 'bg-warn/15 text-warn'
                    }`}
                  >
                    {similarityLabel(substitution.similarity)}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span>{target.category}</span>
                  {substitution.movementPattern ? <span>· {substitution.movementPattern}</span> : null}
                  {substitution.primaryMuscles?.length ? (
                    <span>· {substitution.primaryMuscles.join('、')}</span>
                  ) : null}
                  {substitution.equipment ? <span>· {substitution.equipment}</span> : null}
                </div>

                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  <span className="font-medium text-ink">区别：</span>
                  {substitution.difference}
                </p>

                {substitution.caution ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-warn">
                    <span className="font-medium">注意：</span>
                    {substitution.caution}
                  </p>
                ) : null}

                {target.links?.length ? (
                  <span
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent"
                    onClick={(event) => {
                      event.stopPropagation();
                      const link = target.links?.[0];
                      if (link) openExternalUrl(link.url);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    教学：{target.links[0] ? linkTitle(target.links[0]) : '打开'}
                    <IconArrowRight className="h-3 w-3" />
                  </span>
                ) : null}
              </button>
            );
          })}

          {hasCompletedSets ? (
            <p className="rounded-xl bg-warn/10 p-2.5 text-[11px] leading-relaxed text-warn">
              这个动作已经有完成的组，为避免影响记录，只提供「保留原动作并添加替代动作」，不会删除或改写已完成的组。
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
