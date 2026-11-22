import { useEffect, useMemo, useRef, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { Sheet } from './ui';
import { useToast } from './Toast';
import { SubstitutionSheet } from './SubstitutionSheet';
import {
  IconArrowDown,
  IconArrowUp,
  IconPlus,
  IconSearch,
  IconSort,
  IconTrash,
} from './Icons';
import { uid } from '../lib/id';
import { checkLinkUrl } from '../lib/links';
import type { TemplateExercise } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: string | null;
}

const ROW_HEIGHT_HINT = 64;

/** 编辑模板：名称/目标/简介 + 动作顺序、组数次数、替换、删除、新增 */
export function TemplateEditorSheet({ open, onClose, templateId }: Props) {
  const { templates, exercises, updateTemplate } = useGymLog();
  const { showToast } = useToast();
  const template = templates.find((item) => item.id === templateId) ?? null;

  const [name, setName] = useState('');
  const [targetMuscles, setTargetMuscles] = useState('');
  const [description, setDescription] = useState('');
  const [picking, setPicking] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [subTarget, setSubTarget] = useState<TemplateExercise | null>(null);

  const dragRef = useRef<{ index: number; pointerId: number } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // 只在打开/切换模板时回填，动作编辑引起的模板更新不重置正在输入的文字
  useEffect(() => {
    if (!open) return;
    const current = templates.find((item) => item.id === templateId);
    if (!current) return;
    setName(current.name);
    setTargetMuscles(current.targetMuscles);
    setDescription(current.description ?? '');
    setPicking(false);
    setKeyword('');
    setSubTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const list = query ? exercises.filter((item) => item.name.toLowerCase().includes(query)) : exercises;
    return list.slice(0, 40);
  }, [exercises, keyword]);

  if (!template) return null;

  const saveBasics = () => {
    void updateTemplate(template.id, {
      name: name.trim() || template.name,
      targetMuscles,
      description: description.trim() || undefined,
    });
  };

  const setExercises = (next: TemplateExercise[]) => {
    void updateTemplate(template.id, { exercises: next.map((item, index) => ({ ...item, id: item.id || `te-${index}` })) });
  };

  const moveBy = (from: number, to: number) => {
    if (to < 0 || to >= template.exercises.length || from === to) return;
    const next = [...template.exercises];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setExercises(next);
  };

  const updateItem = (id: string, patch: Partial<TemplateExercise>) => {
    setExercises(template.exercises.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setExercises(template.exercises.filter((item) => item.id !== id));
  };

  const addExercise = (name2: string, exerciseId?: string) => {
    const item: TemplateExercise = {
      id: uid(),
      ...(exerciseId ? { exerciseId } : {}),
      name: name2,
      sets: 3,
      repMin: 8,
      repMax: 12,
    };
    setExercises([...template.exercises, item]);
    setPicking(false);
    setKeyword('');
    showToast(`已加入「${name2}」`);
  };

  const handlePointerDown = (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { index, pointerId: event.pointerId };
    setDraggingIndex(index);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-tpl-row]') as HTMLElement | null;
    if (!element) return;
    const targetIndex = Number(element.dataset.tplRow);
    if (!Number.isFinite(targetIndex)) return;
    if (targetIndex === dragRef.current.index) return;
    moveBy(dragRef.current.index, targetIndex);
    dragRef.current = { ...dragRef.current, index: targetIndex };
    setDraggingIndex(targetIndex);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDraggingIndex(null);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="编辑训练模板"
        footer={
          <button
            type="button"
            onClick={() => {
              saveBasics();
              showToast('已保存模板');
              onClose();
            }}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted" htmlFor="tpl-name">
              模板名称
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveBasics}
              maxLength={30}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted" htmlFor="tpl-target">
              目标肌群
            </label>
            <input
              id="tpl-target"
              value={targetMuscles}
              onChange={(event) => setTargetMuscles(event.target.value)}
              onBlur={saveBasics}
              maxLength={40}
              placeholder="例如：肩 · 三角肌中束"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted" htmlFor="tpl-desc">
              简介 / 备注
            </label>
            <textarea
              id="tpl-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={saveBasics}
              rows={3}
              maxLength={500}
              placeholder="训练思路、注意事项等，可留空"
              className="mt-1 w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
            />
          </div>

          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted">
                动作（{template.exercises.length}）· 按住 ≡ 拖动排序
              </h3>
            </div>

            <div className="space-y-2">
              {template.exercises.map((item, index) => (
                <div
                  key={item.id}
                  data-tpl-row={index}
                  className={`rounded-xl border bg-surface-2 p-2.5 ${
                    draggingIndex === index ? 'border-accent' : 'border-line'
                  }`}
                  style={{ minHeight: ROW_HEIGHT_HINT }}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`拖动 ${item.name}`}
                      onPointerDown={handlePointerDown(index)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className="tap grid h-8 w-7 shrink-0 touch-none place-items-center rounded-lg text-muted"
                    >
                      <IconSort className="h-4 w-4" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.name}</span>
                    <button
                      type="button"
                      aria-label={`${item.name} 上移`}
                      disabled={index === 0}
                      onClick={() => moveBy(index, index - 1)}
                      className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted disabled:opacity-30"
                    >
                      <IconArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.name} 下移`}
                      disabled={index === template.exercises.length - 1}
                      onClick={() => moveBy(index, index + 1)}
                      className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted disabled:opacity-30"
                    >
                      <IconArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${item.name}`}
                      onClick={() => removeItem(item.id)}
                      className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-danger"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <label className="flex items-center gap-1">
                      组数
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.sets}
                        onChange={(event) =>
                          updateItem(item.id, {
                            sets: Math.max(1, Math.min(20, Number(event.target.value.replace(/\D/g, '')) || 1)),
                          })
                        }
                        className="w-12 rounded-md border border-line bg-surface px-1.5 py-1 text-center text-[13px] text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      次数
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.repMin}
                        onChange={(event) =>
                          updateItem(item.id, {
                            repMin: Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1),
                          })
                        }
                        className="w-12 rounded-md border border-line bg-surface px-1.5 py-1 text-center text-[13px] text-ink outline-none focus:border-accent"
                      />
                      –
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.repMax}
                        onChange={(event) =>
                          updateItem(item.id, {
                            repMax: Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1),
                          })
                        }
                        className="w-12 rounded-md border border-line bg-surface px-1.5 py-1 text-center text-[13px] text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSubTarget(item)}
                      className="tap rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-accent"
                    >
                      替换动作
                    </button>
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="shrink-0">休息</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.restSeconds ?? ''}
                      placeholder="秒"
                      onChange={(event) =>
                        updateItem(item.id, {
                          restSeconds: event.target.value
                            ? Math.max(
                                0,
                                Math.min(1800, Number(event.target.value.replace(/\D/g, '')) || 0),
                              )
                            : undefined,
                        })
                      }
                      className="w-14 rounded-md border border-line bg-surface px-1.5 py-1 text-center text-[12px] text-ink outline-none focus:border-accent"
                    />
                    <input
                      defaultValue={item.link?.url ?? ''}
                      onBlur={(event) => {
                        const raw = event.target.value.trim();
                        if (!raw) {
                          if (item.link) updateItem(item.id, { link: undefined });
                          return;
                        }
                        const checked = checkLinkUrl(raw);
                        if (!checked.ok) {
                          showToast(checked.error);
                          event.target.value = item.link?.url ?? '';
                          return;
                        }
                        updateItem(item.id, {
                          link: {
                            id: item.link?.id ?? uid(),
                            title: item.link?.title ?? '',
                            url: checked.url,
                          },
                        });
                      }}
                      placeholder="教学链接（可选，可粘贴分享文案）"
                      className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent"
                    />
                  </div>
                </div>
              ))}
            </div>

            {picking ? (
              <div className="mt-2 rounded-xl border border-line bg-surface p-2.5">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                  <IconSearch className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索动作名称"
                    autoFocus
                    autoComplete="off"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
                  />
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addExercise(item.name, item.id)}
                      className="tap flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left active:bg-surface-2"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-[10px] font-semibold text-accent">
                        {item.category}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px]">{item.name}</span>
                      <IconPlus className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  ))}
                  {filtered.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted">没有找到动作</p>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(false);
                      setKeyword('');
                    }}
                    className="tap flex-1 rounded-lg border border-line py-2 text-xs font-medium text-muted"
                  >
                    取消
                  </button>
                  {keyword.trim() ? (
                    <button
                      type="button"
                      onClick={() => addExercise(keyword.trim())}
                      className="tap flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-ink"
                    >
                      直接加入「{keyword.trim()}」
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="tap mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-sm font-medium text-muted"
              >
                <IconPlus className="h-4 w-4" />
                添加动作
              </button>
            )}
          </section>
        </div>
      </Sheet>

      <SubstitutionSheet
        open={subTarget !== null}
        onClose={() => setSubTarget(null)}
        from={subTarget ? { id: subTarget.exerciseId, name: subTarget.name } : null}
        allowAdd={false}
        onApply={(target) => {
          if (!subTarget) return;
          updateItem(subTarget.id, { exerciseId: target.id, name: target.name });
          showToast(`已替换为「${target.name}」`);
        }}
      />
    </>
  );
}
