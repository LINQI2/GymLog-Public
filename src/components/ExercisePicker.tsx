import { useMemo, useRef, useState } from 'react';
import { CATEGORIES, type ExerciseCatalogItem, type ExerciseCategory } from '../types';
import { useGymLog } from '../store/gymlog';
import { sortExercises } from '../lib/queries';
import { NAME_MAX, normalizeName } from '../lib/validation';
import { Sheet } from './ui';
import { IconCheck, IconPlus, IconSearch, IconStar } from './Icons';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 已在当天记录中的动作（按动作库 ID 或名称匹配） */
  usedKeys: { ids: Set<string>; names: Set<string> };
  onPick: (exercise: { id?: string; name: string }) => void;
}

export function ExercisePicker({ open, onClose, usedKeys, onPick }: Props) {
  const { exercises, createExercise } = useGymLog();
  const { showToast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('其他');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const query = keyword.trim().toLowerCase();

  const filtered = useMemo(() => {
    return exercises.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query);
    });
  }, [exercises, category, query]);

  const favorites = filtered.filter((e) => e.isFavorite);
  const recents = filtered
    .filter((e) => !e.isFavorite && e.recentlyUsedAt)
    .sort((a, b) => (b.recentlyUsedAt ?? '').localeCompare(a.recentlyUsedAt ?? ''))
    .slice(0, 8);
  const rest = sortExercises(filtered.filter((e) => !favorites.includes(e) && !recents.includes(e)));

  const isUsed = (item: ExerciseCatalogItem) =>
    usedKeys.ids.has(item.id) || usedKeys.names.has(item.name);

  const reset = () => {
    setKeyword('');
    setCategory('all');
    setCreating(false);
    setNewName('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (submitting) return;
    const name = normalizeName(newName);
    if (!name) {
      showToast('请输入动作名称');
      nameRef.current?.focus();
      return;
    }
    if (name.length > NAME_MAX) {
      showToast(`动作名称最多 ${NAME_MAX} 个字`);
      nameRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const existed = exercises.some((e) => e.name === name);
      const item = await createExercise(name, newCategory);
      showToast(existed ? `「${item.name}」已存在，已直接添加` : `已创建「${item.name}」`);
      reset();
      onPick({ id: item.id, name: item.name });
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const startCreate = () => {
    setNewName(keyword.trim());
    setNewCategory(category === 'all' ? '其他' : category);
    setCreating(true);
  };

  const renderGroup = (title: string, items: ExerciseCatalogItem[]) => {
    if (items.length === 0) return null;
    return (
      <section key={title} className="mb-4">
        <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">{title}</h3>
        <div className="card divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                reset();
                onPick({ id: item.id, name: item.name });
              }}
              className="tap flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-[11px] font-semibold text-accent">
                {item.category}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{item.name}</span>
              {item.isFavorite ? <IconStar filled className="h-4 w-4 text-warn" /> : null}
              {isUsed(item) ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
                  <IconCheck className="h-3.5 w-3.5" />
                  已添加
                </span>
              ) : (
                <IconPlus className="h-4 w-4 shrink-0 text-muted" />
              )}
            </button>
          ))}
        </div>
      </section>
    );
  };

  return (
    <Sheet open={open} onClose={close} title="添加动作">
      <div className="sticky -top-3 z-10 -mx-4 mb-3 bg-surface px-4 pb-2 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索动作名称"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
          {keyword ? (
            <button type="button" onClick={() => setKeyword('')} className="text-xs text-muted">
              清空
            </button>
          ) : null}
        </div>

        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
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

      {creating ? (
        <section className="card mb-4 p-4">
          <h3 className="mb-3 text-sm font-semibold">创建新动作</h3>
          <input
            ref={nameRef}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              // 中文输入法回车用于上屏，此时 isComposing 为 true，不能当作提交
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="动作名称，例如：反手哑铃侧平举"
            maxLength={NAME_MAX}
            enterKeyHint="done"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setNewCategory(item)}
                className={`tap rounded-full border px-3 py-1.5 text-xs font-medium ${
                  newCategory === item
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted"
            >
              取消
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCreate()}
              className="tap flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
            >
              {submitting ? '创建中…' : '创建并使用'}
            </button>
          </div>
        </section>
      ) : null}

      {filtered.length === 0 && !creating ? (
        <div className="card p-5 text-center">
          <p className="text-sm text-muted">没有找到动作</p>
          <button
            type="button"
            onClick={startCreate}
            className="tap mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <IconPlus className="h-4 w-4" />
            {keyword.trim() ? `创建「${keyword.trim()}」` : '创建新动作'}
          </button>
        </div>
      ) : null}

      {!creating && filtered.length > 0 ? (
        <>
          {renderGroup('收藏', favorites)}
          {renderGroup('最近使用', recents)}
          {renderGroup(query || category !== 'all' ? '搜索结果' : '全部动作', rest)}
          <button
            type="button"
            onClick={startCreate}
            className="tap mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 text-sm font-medium text-muted"
          >
            <IconPlus className="h-4 w-4" />
            没有想要的？创建新动作
          </button>
        </>
      ) : null}
    </Sheet>
  );
}
