import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { ConfirmDialog, Sheet } from './ui';
import { useToast } from './Toast';
import { SubstitutionSheet } from './SubstitutionSheet';
import { TemplateEditorSheet } from './TemplateEditorSheet';
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconExternal,
  IconStar,
  IconTrash,
} from './Icons';
import { linkTitle, openExternalUrl } from '../lib/links';
import type { ExerciseCatalogItem, TemplateExercise, TrainingTemplate } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: string | null;
  /** 目标训练日期（YYYY-MM-DD），默认今天 */
  date: string;
}

export function TemplateSheet({ open, onClose, templateId, date }: Props) {
  const {
    templates,
    exercises,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    addExerciseToSession,
  } = useGymLog();
  const { showToast } = useToast();

  const template = templates.find((item) => item.id === templateId) ?? null;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subTarget, setSubTarget] = useState<TemplateExercise | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setSelected(new Set(template.exercises.map((item) => item.id)));
    setEditorOpen(false);
    setApplyOpen(false);
    setConfirmDelete(false);
    setSubTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId]);

  const chosen = useMemo(
    () => (template ? template.exercises.filter((item) => selected.has(item.id)) : []),
    [template, selected],
  );

  if (!template) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const replaceItem = (item: TemplateExercise, target: ExerciseCatalogItem) => {
    void updateTemplate(template.id, {
      exercises: template.exercises.map((current) =>
        current.id === item.id
          ? { ...current, exerciseId: target.id, name: target.name }
          : current,
      ),
    });
    showToast(`模板中的「${item.name}」已替换为「${target.name}」`);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={template.name}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted"
            >
              编辑模板
            </button>
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => setApplyOpen(true)}
              className="tap flex-[1.4] rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              添加到今日训练（{chosen.length}）
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-accent">{template.targetMuscles || '未填写目标肌群'}</p>
                {template.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
                    {template.description}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted">
                  {template.exercises.length} 个动作
                  {template.builtin ? ' · 内置示例，可自由修改' : ''}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void updateTemplate(template.id, { isFavorite: !template.isFavorite })}
                className={`tap flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                  template.isFavorite
                    ? 'border-warn/40 bg-warn/10 text-warn'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                <IconStar filled={template.isFavorite} className="h-3.5 w-3.5" />
                {template.isFavorite ? '已收藏' : '收藏'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void duplicateTemplate(template.id).then((copy) => {
                    if (copy) showToast(`已复制为「${copy.name}」`);
                  });
                }}
                className="tap flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-medium text-muted"
              >
                <IconCopy className="h-3.5 w-3.5" />
                复制
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="tap ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-danger"
              >
                <IconTrash className="h-3.5 w-3.5" />
                删除
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {template.exercises.map((item, index) => {
              const active = selected.has(item.id);
              const catalog = item.exerciseId
                ? exercises.find((exercise) => exercise.id === item.exerciseId)
                : exercises.find((exercise) => exercise.name === item.name);
              const link = item.link ?? catalog?.links?.[0];
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-2.5 ${
                    active ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-label={`${active ? '取消选择' : '选择'} ${item.name}`}
                      className={`tap mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        active ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface'
                      }`}
                    >
                      {active ? <IconCheck className="h-3.5 w-3.5" /> : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] text-muted">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item.name}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {item.sets} 组 × {item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`} 次
                        {item.restSeconds ? ` · 休息 ${item.restSeconds} 秒` : ''}
                      </p>
                      {item.note ? (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{item.note}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSubTarget(item)}
                        className="tap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                      >
                        替代
                      </button>
                      {link ? (
                        <button
                          type="button"
                          onClick={() => openExternalUrl(link.url)}
                          className="tap flex items-center gap-0.5 text-[10px] text-muted"
                        >
                          <IconExternal className="h-3 w-3" />
                          {linkTitle(link)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            添加后只会创建动作卡片，建议组数与次数作为目标显示，不会自动生成已完成的组。
          </p>
        </div>
      </Sheet>

      <TemplateEditorSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        templateId={template.id}
      />

      <TemplateApplySheet
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        template={template}
        exercises={chosen}
        date={date}
        onDone={(added, skipped) => {
          setApplyOpen(false);
          onClose();
          showToast(
            skipped
              ? `已添加 ${added} 个动作，跳过 ${skipped} 个已存在的动作`
              : `已添加 ${added} 个动作到今日训练`,
          );
        }}
        add={(item) =>
          addExerciseToSession(date, {
            exerciseId: item.exerciseId,
            name: item.name,
            target: { sets: item.sets, repMin: item.repMin, repMax: item.repMax },
          })
        }
      />

      <SubstitutionSheet
        open={subTarget !== null}
        onClose={() => setSubTarget(null)}
        from={subTarget ? { id: subTarget.exerciseId, name: subTarget.name } : null}
        allowAdd={false}
        onApply={(target) => {
          if (subTarget) replaceItem(subTarget, target);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`删除「${template.name}」？`}
        description="只会删除这个模板；已经导入到训练记录里的动作和组不受影响。"
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteTemplate(template.id);
          onClose();
          showToast('已删除模板');
        }}
      />
    </>
  );
}

/* ==================== 导入预览 ==================== */

interface ApplyProps {
  open: boolean;
  onClose: () => void;
  template: TrainingTemplate;
  exercises: TemplateExercise[];
  date: string;
  onDone: (added: number, skipped: number) => void;
  add: (item: TemplateExercise) => Promise<{ entryId: string; existed: boolean }>;
}

function TemplateApplySheet({ open, onClose, template, exercises, date, onDone, add }: ApplyProps) {
  const { getSession, exercises: catalog } = useGymLog();
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const session = getSession(date);
  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of exercises) {
      const target = item.exerciseId ?? catalog.find((exercise) => exercise.name === item.name)?.id;
      const exists = session?.exercises.some(
        (entry) =>
          (target && entry.exerciseId === target) ||
          entry.name === item.name,
      );
      if (exists) set.add(item.id);
    }
    return set;
  }, [exercises, session, catalog]);

  useEffect(() => {
    if (!open) return;
    // 默认跳过当天已存在的同名动作，避免静默重复
    setSkipIds(new Set());
    setBusy(false);
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    let added = 0;
    let skipped = 0;
    for (const item of exercises) {
      if (skipIds.has(item.id)) {
        skipped += 1;
        continue;
      }
      const result = await add(item);
      if (result.existed) skipped += 1;
      else added += 1;
    }
    setBusy(false);
    onDone(added, skipped);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="添加到今日训练"
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConfirm()}
          className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {busy ? '正在添加…' : `确认添加（${exercises.length - skipIds.size}）`}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
          只创建动作卡片，不生成已完成的组。建议组数与次数会作为目标参考（当前版本不在卡片上强制显示）。
          已存在的动作默认跳过，不会覆盖当天已有记录。
        </p>

        <div className="space-y-2">
          {exercises.map((item) => {
            const conflict = conflictIds.has(item.id);
            const skipped = skipIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-2.5 ${
                  conflict ? 'border-warn/40 bg-warn/5' : 'border-line bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.name}</span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {item.sets} × {item.repMin}–{item.repMax}
                  </span>
                </div>

                {conflict ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-md bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                      今天已有
                    </span>
                    <div className="ml-auto flex overflow-hidden rounded-md border border-line">
                      <button
                        type="button"
                        onClick={() =>
                          setSkipIds((prev) => {
                            const next = new Set(prev);
                            next.delete(item.id);
                            return next;
                          })
                        }
                        className={`tap px-2 py-1 text-[10px] font-medium ${
                          skipped ? 'bg-surface text-muted' : 'bg-accent text-accent-ink'
                        }`}
                      >
                        合并（复用卡片）
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSkipIds((prev) => {
                            const next = new Set(prev);
                            next.add(item.id);
                            return next;
                          })
                        }
                        className={`tap px-2 py-1 text-[10px] font-medium ${
                          skipped ? 'bg-accent text-accent-ink' : 'bg-surface text-muted'
                        }`}
                      >
                        跳过
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-muted">将新建动作卡片</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-muted">
          <IconArrowRight className="h-3 w-3" />
          模板修改或删除不会影响已经导入到 {template.name} 之外的历史记录。
        </p>
      </div>
    </Sheet>
  );
}
