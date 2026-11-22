import { useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { ConfirmDialog, EmptyState, Sheet } from '../components/ui';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';
import {
  IconBook,
  IconDumbbell,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash,
} from '../components/Icons';
import { useToast } from '../components/Toast';
import { CATEGORIES, type ExerciseCatalogItem, type ExerciseCategory } from '../types';
import { sortExercises } from '../lib/queries';
import { NAME_MAX, normalizeName } from '../lib/validation';

export function ExercisesPage() {
  const { exercises, createExercise, updateExercise, deleteExercise, sessions, restoreDefaults } =
    useGymLog();
  const { showToast } = useToast();

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('其他');
  const [editing, setEditing] = useState<ExerciseCatalogItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ExerciseCategory>('其他');
  const [confirmDelete, setConfirmDelete] = useState<ExerciseCatalogItem | null>(null);
  const [infoTarget, setInfoTarget] = useState<ExerciseCatalogItem | null>(null);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      for (const entry of session.exercises) {
        if (!entry.exerciseId) continue;
        map.set(entry.exerciseId, (map.get(entry.exerciseId) ?? 0) + entry.sets.length);
      }
    }
    return map;
  }, [sessions]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const list = exercises.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query);
    });
    return sortExercises(list);
  }, [exercises, category, keyword]);

  const openEdit = (item: ExerciseCatalogItem) => {
    setEditing(item);
    setEditName(item.name);
    setEditCategory(item.category);
  };

  const handleCreate = async () => {
    const name = normalizeName(newName);
    if (!name) {
      showToast('请输入动作名称');
      return;
    }
    if (name.length > NAME_MAX) {
      showToast(`动作名称最多 ${NAME_MAX} 个字`);
      return;
    }
    if (exercises.some((e) => e.name === name)) {
      showToast(`「${name}」已经在动作库里了`);
      return;
    }
    try {
      await createExercise(name, newCategory);
      setNewName('');
      setCreating(false);
      showToast(`已创建「${name}」`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建失败，请重试');
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    const name = normalizeName(editName) || editing.name;
    if (name.length > NAME_MAX) {
      showToast(`动作名称最多 ${NAME_MAX} 个字`);
      return;
    }
    if (exercises.some((e) => e.id !== editing.id && e.name === name)) {
      showToast('已有同名动作，请换一个名称');
      return;
    }
    void updateExercise(editing.id, { name, category: editCategory });
    setEditing(null);
    showToast('已保存');
  };

  return (
    <>
      <PageHeader
        title="动作管理"
        subtitle={`共 ${exercises.length} 个动作 · 删除动作库不影响历史记录`}
        right={
          <button
            type="button"
            aria-label="新增动作"
            onClick={() => setCreating(true)}
            className="tap grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索动作"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
            autoComplete="off"
          />
        </div>

        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {(['all', ...CATEGORIES] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item as ExerciseCategory | 'all')}
              className={`tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                category === item
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {item === 'all' ? '全部' : item}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconDumbbell className="h-6 w-6" />}
            title={exercises.length === 0 ? '动作库是空的' : '没有匹配的动作'}
            description={
              exercises.length === 0 ? '点击右上角 + 新建动作，或恢复默认动作库。' : undefined
            }
            action={
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="tap rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
                >
                  新建动作
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void restoreDefaults().then(() => showToast('已恢复默认动作库'));
                  }}
                  className="tap rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted"
                >
                  恢复默认动作
                </button>
              </div>
            }
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {filtered.map((item) => {
              const sets = usageCount.get(item.id) ?? 0;
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void updateExercise(item.id, { isFavorite: !item.isFavorite })}
                    aria-label="收藏"
                    className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  >
                    <IconStar
                      filled={item.isFavorite}
                      className={`h-4.5 w-4.5 ${item.isFavorite ? 'text-warn' : 'text-muted'}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="tap min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[15px] font-medium">{item.name}</div>
                    <div className="text-[11px] text-muted">
                      {item.category}
                      {sets > 0 ? ` · 已记录 ${sets} 组` : ''}
                      {item.description || item.links?.length ? ' · 有学习资料' : ''}
                      {item.recentlyUsedAt ? ' · 最近使用' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoTarget(item)}
                    aria-label={`${item.name} 的学习资料`}
                    className={`tap grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      item.description || item.links?.length ? 'text-accent' : 'text-muted'
                    }`}
                  >
                    <IconBook className="h-4.5 w-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(item)}
                    aria-label="删除"
                    className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted"
                  >
                    <IconTrash className="h-4.5 w-4.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="新建动作"
        footer={
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            创建
          </button>
        }
      >
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="动作名称，例如：反手哑铃侧平举"
          maxLength={NAME_MAX}
          enterKeyHint="done"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
        />
        <CategoryPicker value={newCategory} onChange={setNewCategory} />
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="编辑动作"
        footer={
          <button
            type="button"
            onClick={() => saveEdit()}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存
          </button>
        }
      >
        <input
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              saveEdit();
            }
          }}
          maxLength={NAME_MAX}
          enterKeyHint="done"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
        />
        <CategoryPicker value={editCategory} onChange={setEditCategory} />
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          改名只影响以后新增的记录；已经记录的历史仍保留当时的动作名称，不会被改动。
        </p>
      </Sheet>

      <ExerciseInfoSheet
        open={infoTarget !== null}
        onClose={() => setInfoTarget(null)}
        name={infoTarget?.name ?? ''}
        exercise={infoTarget}
        editable
        onSave={(patch) => {
          const target = infoTarget;
          if (target) void updateExercise(target.id, patch);
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`删除「${confirmDelete?.name ?? ''}」？`}
        description="只会从动作库移除这个动作，已有的训练历史不受影响。"
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void deleteExercise(target.id);
        }}
      />
    </>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: ExerciseCategory;
  onChange: (value: ExerciseCategory) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {CATEGORIES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`tap rounded-full border px-3 py-1.5 text-xs font-medium ${
            value === item
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
