import { useEffect, useMemo, useRef, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { useRestTimer } from '../store/restTimer';
import { useToast } from './Toast';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseInfoSheet } from './ExerciseInfoSheet';
import { EntryDetailSheet } from './EntryDetailSheet';
import { SubstitutionSheet } from './SubstitutionSheet';
import { TemplatePickerSheet } from './TemplatePickerSheet';
import { TemplateSheet } from './TemplateSheet';
import { ConfirmDialog, EmptyState, Segmented, Sheet } from './ui';
import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconClock,
  IconDumbbell,
  IconNote,
  IconPlus,
  IconSort,
} from './Icons';
import { sessionStats, volumeLabel } from '../lib/format';
import { clockLabel, durationLabel, todayISO } from '../lib/date';
import { orderEntries, sessionStartIso } from '../lib/queries';
import { uid } from '../lib/id';
import type {
  EntrySortMode,
  ExerciseCatalogItem,
  ExerciseEntry,
  SetEntry,
  TemplateExercise,
} from '../types';

interface Props {
  date: string;
  /** 是否显示当日备注输入（历史详情页与首页均可编辑） */
  withNote?: boolean;
}

export function WorkoutEditor({ date, withNote = true }: Props) {
  const {
    getSession,
    exercises,
    addExerciseToSession,
    addSet,
    updateSet,
    deleteSet,
    deleteEntry,
    renameEntry,
    setNote,
    undoLastAdd,
    lastEntryBefore,
    updateExercise,
    moveEntry,
    setSortMode,
    resetSessionStart,
    replaceEntryExercise,
    createTemplate,
    settings,
  } = useGymLog();
  const { showToast } = useToast();
  const restTimer = useRestTimer();

  const session = getSession(date);
  const entries = useMemo(
    () => (session ? orderEntries(session) : []),
    // session 引用变化即说明有写入，需要重新排序
    [session],
  );
  const sortMode: EntrySortMode = session?.sortMode === 'time' ? 'time' : 'manual';
  const stats = sessionStats(session ?? { id: '', date, exercises: [], createdAt: '', updatedAt: '' });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameText, setRenameText] = useState('');
  const [noteText, setNoteText] = useState(session?.note ?? '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [infoTarget, setInfoTarget] = useState<{
    name: string;
    exercise: ExerciseCatalogItem | null;
  } | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [resetStartOpen, setResetStartOpen] = useState(false);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [subEntry, setSubEntry] = useState<ExerciseEntry | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTarget, setTemplateTarget] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  // 「已练时长」每分钟刷新一次，不影响任何记录
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const startIso = session ? sessionStartIso(session) : undefined;
  const startClock = clockLabel(startIso);
  const elapsedLabel =
    date === todayISO() && startIso
      ? (() => {
          const diff = now - Date.parse(startIso);
          // 刚重置或时钟回拨时 diff 可能为负，统一显示「不到 1 分钟」
          return diff < 60_000 ? '不到 1 分钟' : durationLabel(diff);
        })()
      : null;
  const detailEntry = entries.find((entry) => entry.id === detailEntryId) ?? null;

  // 切换日期时重置与日期相关的本地状态
  useEffect(() => {
    setExpandedSetId(null);
    setNoteText(getSession(date)?.note ?? '');
    setNoteOpen(Boolean(getSession(date)?.note));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const usedKeys = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const entry of entries) {
      names.add(entry.name);
      if (entry.exerciseId) ids.add(entry.exerciseId);
    }
    return { ids, names };
  }, [entries]);

  const scrollToEntry = (entryId: string) => {
    window.setTimeout(() => {
      cardRefs.current.get(entryId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handlePick = async (picked: { id?: string; name: string }) => {
    const result = await addExerciseToSession(date, { exerciseId: picked.id, name: picked.name });
    setPickerOpen(false);
    if (result.existed) {
      showToast('这个动作今天已经记录过了');
    }
    scrollToEntry(result.entryId);
  };

  const handleAddSet = async (entryId: string) => {
    const setId = await addSet(date, entryId);
    if (!setId) {
      showToast('这一组数据不合法，未记录');
      return;
    }
    setExpandedSetId(setId);
    // 记录成功才开始休息计时：数据保存失败时不会误启动
    if (settings.restAutoStart) restTimer.start();
    showToast('已记录一组', {
      label: '撤销',
      onClick: () => {
        void undoLastAdd(date);
      },
    });
  };

  const openInfo = (entry: ExerciseEntry) => {
    const catalogItem = entry.exerciseId
      ? exercises.find((item) => item.id === entry.exerciseId)
      : exercises.find((item) => item.name === entry.name);
    setInfoTarget({ name: entry.name, exercise: catalogItem ?? null });
  };

  const handleSubstitute = async (target: ExerciseCatalogItem, mode: 'replace' | 'add') => {
    const entry = subEntry;
    if (!entry) return;
    // 已有完成的组时只追加，不替换，避免改写历史数据
    if (mode === 'add' || entry.sets.length > 0) {
      const result = await addExerciseToSession(date, { exerciseId: target.id, name: target.name });
      showToast(result.existed ? '这个动作今天已经在列表里了' : `已添加替代动作「${target.name}」`);
      scrollToEntry(result.entryId);
      return;
    }
    await replaceEntryExercise(date, entry.id, { exerciseId: target.id, name: target.name });
    showToast(`已替换为「${target.name}」`);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      showToast('请填写模板名称');
      return;
    }
    const items: TemplateExercise[] = entries.map((entry) => {
      const last = entry.sets[entry.sets.length - 1];
      const reps = last?.reps ?? 10;
      return {
        id: uid(),
        ...(entry.exerciseId ? { exerciseId: entry.exerciseId } : {}),
        name: entry.name,
        sets: Math.max(1, entry.sets.length || 3),
        repMin: Math.max(1, reps - 2),
        repMax: reps + 2,
      };
    });
    await createTemplate({ name, targetMuscles: templateTarget.trim(), exercises: items });
    setSaveTemplateOpen(false);
    showToast(`已保存模板「${name}」`);
  };

  const handleUpdateSet = (
    entryId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'type'>>,
  ) => {
    void updateSet(date, entryId, setId, patch);
  };

  const handleDeleteSet = async (entryId: string, setId: string) => {
    setExpandedSetId((current) => (current === setId ? null : current));
    await deleteSet(date, entryId, setId);
    showToast('已删除该组');
  };

  const saveNote = (value: string) => {
    void setNote(date, value);
  };

  return (
    <div className="px-4 pb-6 pt-3">
      {/* 概览 */}
      <div className="card mb-3 flex items-stretch divide-x divide-line">
        <div className="flex flex-1 flex-col items-center justify-center py-2.5">
          <span className="text-[19px] font-bold leading-tight">{stats.exerciseCount}</span>
          <span className="text-[11px] text-muted">动作</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-2.5">
          <span className="text-[19px] font-bold leading-tight">{stats.setCount}</span>
          <span className="text-[11px] text-muted">总组数</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-2.5">
          <span className="text-[19px] font-bold leading-tight">{volumeLabel(stats.volume)}</span>
          <span className="text-[11px] text-muted">总容量</span>
        </div>
      </div>

      {startClock || entries.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted">
          <IconClock className="h-3.5 w-3.5" />
          <span>
            开始 {startClock ?? '—'}
            {elapsedLabel ? ` · 已练 ${elapsedLabel}` : ''}
            {entries.length > 0 ? ` · ${sortMode === 'time' ? '按时间排序' : '手动排序'}` : ''}
          </span>
          {session && date === todayISO() ? (
            <button
              type="button"
              onClick={() => setResetStartOpen(true)}
              className="tap rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted"
            >
              重置开始时间
            </button>
          ) : null}
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setTemplateName('');
                setTemplateTarget('');
                setSaveTemplateOpen(true);
              }}
              className="tap rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted"
            >
              存为模板
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="tap flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
        >
          <IconPlus className="h-5 w-5" />
          添加动作
        </button>
        <button
          type="button"
          onClick={() => setTemplatePickerOpen(true)}
          className="tap flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink"
        >
          <IconBook className="h-5 w-5 text-accent" />
          训练方案
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          disabled={entries.length < 2}
          aria-label="动作排序"
          className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted disabled:opacity-40"
        >
          <IconSort className="h-5 w-5" />
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<IconDumbbell className="h-6 w-6" />}
          title="今天还没有记录"
          description="点上面的「添加动作」，选择或新建一个动作，然后逐组记录重量和次数。"
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const catalogItem = entry.exerciseId
              ? exercises.find((e) => e.id === entry.exerciseId)
              : exercises.find((e) => e.name === entry.name);
            return (
              <div
                key={entry.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(entry.id, node);
                  else cardRefs.current.delete(entry.id);
                }}
              >
                <ExerciseCard
                  entry={entry}
                  lastRecord={lastEntryBefore(date, { exerciseId: entry.exerciseId, name: entry.name })}
                  expandedSetId={expandedSetId}
                  isFavorite={catalogItem ? catalogItem.isFavorite : null}
                  onToggleSet={setExpandedSetId}
                  onAddSet={() => {
                    void handleAddSet(entry.id);
                  }}
                  onUpdateSet={(setId, patch) => handleUpdateSet(entry.id, setId, patch)}
                  onDeleteSet={(setId) => {
                    void handleDeleteSet(entry.id, setId);
                  }}
                  onRequestDelete={() => setConfirmDelete({ id: entry.id, name: entry.name })}
                  onRequestRename={() => {
                    setRenameTarget({ id: entry.id, name: entry.name });
                    setRenameText(entry.name);
                  }}
                  onToggleFavorite={
                    catalogItem
                      ? () => {
                          void updateExercise(catalogItem.id, { isFavorite: !catalogItem.isFavorite });
                        }
                      : null
                  }
                  onOpenInfo={() => openInfo(entry)}
                  hasInfo={Boolean(catalogItem?.description || catalogItem?.links?.length)}
                  onOpenDetail={() => setDetailEntryId(entry.id)}
                  onOpenSubstitution={() => setSubEntry(entry)}
                />
              </div>
            );
          })}
        </div>
      )}

      {withNote ? (
        <div className="mt-4">
          {noteOpen ? (
            <div className="card p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                <IconNote className="h-4 w-4" />
                当日备注
              </div>
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                onBlur={() => saveNote(noteText)}
                rows={3}
                placeholder="今天的状态、重量调整原因等"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] outline-none focus:border-accent"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 text-sm font-medium text-muted"
            >
              <IconNote className="h-4 w-4" />
              添加当日备注
            </button>
          )}
        </div>
      ) : null}

      <TemplatePickerSheet
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onPick={(id) => {
          setTemplatePickerOpen(false);
          setTemplateId(id);
        }}
      />

      <TemplateSheet
        open={templateId !== null}
        onClose={() => setTemplateId(null)}
        templateId={templateId}
        date={date}
      />

      <ExerciseInfoSheet
        open={infoTarget !== null}
        onClose={() => setInfoTarget(null)}
        name={infoTarget?.name ?? ''}
        exercise={infoTarget?.exercise ?? null}
      />

      <EntryDetailSheet
        open={detailEntry !== null}
        onClose={() => setDetailEntryId(null)}
        entry={detailEntry}
      />

      <SubstitutionSheet
        open={subEntry !== null}
        onClose={() => setSubEntry(null)}
        from={subEntry ? { id: subEntry.exerciseId, name: subEntry.name } : null}
        hasCompletedSets={Boolean(subEntry && subEntry.sets.length > 0)}
        onApply={(target, mode) => {
          void handleSubstitute(target, mode);
        }}
      />

      <Sheet
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        title="存为训练模板"
        footer={
          <button
            type="button"
            onClick={() => void handleSaveTemplate()}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存模板
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted" htmlFor="save-tpl-name">
              模板名称
            </label>
            <input
              id="save-tpl-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="例如：肩部训练"
              maxLength={30}
              autoFocus
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted" htmlFor="save-tpl-target">
              目标肌群（可选）
            </label>
            <input
              id="save-tpl-target"
              value={templateTarget}
              onChange={(event) => setTemplateTarget(event.target.value)}
              placeholder="例如：肩 · 三角肌中束"
              maxLength={40}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
            />
          </div>
          <p className="rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
            会把当天 {entries.length} 个动作保存为模板：组数取今天已记录的组数，次数取最后一组上下浮动 2 次。
            只作用于模板，不会改动任何训练记录。
          </p>
        </div>
      </Sheet>

      <Sheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="动作排序"
        footer={
          <button
            type="button"
            onClick={() => setSortOpen(false)}
            className="tap w-full rounded-xl bg-surface-2 py-3 text-sm font-semibold text-muted"
          >
            完成
          </button>
        }
      >
        <Segmented<EntrySortMode>
          value={sortMode}
          onChange={(mode) => {
            void setSortMode(date, mode);
            showToast(mode === 'time' ? '已按开始时间排序' : '已切换为手动排序');
          }}
          options={[
            { value: 'manual', label: '手动排序' },
            { value: 'time', label: '按开始时间' },
          ]}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          手动排序：用箭头上下调整，顺序会保存在这一天；按开始时间：按每个动作第一次记录一组的先后排列。
        </p>

        <div className="mt-3 space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface text-[11px] font-bold text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{entry.name}</span>
                <span className="block text-[10px] text-muted">
                  开始 {clockLabel(entry.startedAt) ?? '—'}
                </span>
              </span>
              <button
                type="button"
                aria-label={`${entry.name} 上移`}
                disabled={index === 0 || sortMode === 'time'}
                onClick={() => {
                  void moveEntry(date, entry.id, -1);
                }}
                className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted disabled:opacity-30"
              >
                <IconArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`${entry.name} 下移`}
                disabled={index === entries.length - 1 || sortMode === 'time'}
                onClick={() => {
                  void moveEntry(date, entry.id, 1);
                }}
                className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted disabled:opacity-30"
              >
                <IconArrowDown className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {sortMode === 'time' ? (
          <p className="mt-2 rounded-xl bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
            当前按时间排序，箭头已禁用。切换到「手动排序」后即可自由调整。
          </p>
        ) : null}
      </Sheet>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        usedKeys={usedKeys}
        onPick={(picked) => {
          void handlePick(picked);
        }}
      />

      <ConfirmDialog
        open={resetStartOpen}
        title="重置今日开始时间？"
        description="开始时间会改为当前时间，「已练时长」从 0 重新计算。所有组的重量、次数、完成时间都不会改动。"
        confirmText="重置"
        onCancel={() => setResetStartOpen(false)}
        onConfirm={() => {
          setResetStartOpen(false);
          setNow(Date.now());
          void resetSessionStart(date).then(() => showToast('已重置开始时间'));
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除这个动作？"
        description={`将删除当天的「${confirmDelete?.name ?? ''}」及其所有组记录，动作库不受影响。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void deleteEntry(date, target.id);
        }}
      />

      <Sheet
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="重命名（仅影响当天记录）"
        footer={
          <button
            type="button"
            onClick={() => {
              if (renameTarget) void renameEntry(date, renameTarget.id, renameText);
              setRenameTarget(null);
            }}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存
          </button>
        }
      >
        <input
          value={renameText}
          onChange={(event) => setRenameText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (renameTarget) void renameEntry(date, renameTarget.id, renameText);
              setRenameTarget(null);
            }
          }}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
        />
        <p className="mt-2 text-xs text-muted">
          只修改当天记录里的名称，动作库中的名称不变。
        </p>
      </Sheet>
    </div>
  );
}
