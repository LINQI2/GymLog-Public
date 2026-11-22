import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { Sheet } from './ui';
import { useToast } from './Toast';
import { IconSearch } from './Icons';
import type { SubstitutionSimilarity } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  presetFromId?: string;
}

/** 自定义替代关系：原动作 → 替代动作，相似度、区别、器械、注意事项 */
export function SubstitutionEditorSheet({ open, onClose, presetFromId }: Props) {
  const { exercises, createSubstitution } = useGymLog();
  const { showToast } = useToast();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [selecting, setSelecting] = useState<'from' | 'to' | null>(null);
  const [keyword, setKeyword] = useState('');
  const [similarity, setSimilarity] = useState<SubstitutionSimilarity>('close');
  const [difference, setDifference] = useState('');
  const [equipment, setEquipment] = useState('');
  const [caution, setCaution] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFromId(presetFromId ?? '');
    setToId('');
    setSelecting(null);
    setKeyword('');
    setSimilarity('close');
    setDifference('');
    setEquipment('');
    setCaution('');
    setError(null);
  }, [open, presetFromId]);

  const from = exercises.find((item) => item.id === fromId);
  const to = exercises.find((item) => item.id === toId);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return exercises
      .filter((item) => (query ? item.name.toLowerCase().includes(query) : true))
      .slice(0, 60);
  }, [exercises, keyword]);

  const pick = (id: string) => {
    if (selecting === 'from') {
      setFromId(id);
      if (id === toId) setToId('');
    } else if (selecting === 'to') {
      setToId(id);
    }
    setSelecting(null);
    setKeyword('');
  };

  const save = () => {
    if (!from) {
      setError('请选择原动作');
      return;
    }
    if (!to) {
      setError('请选择替代动作');
      return;
    }
    if (from.id === to.id) {
      setError('原动作和替代动作不能相同');
      return;
    }
    if (!difference.trim()) {
      setError('请填写主要区别，避免把「同一肌群」当成完全等效');
      return;
    }
    setError(null);
    void createSubstitution({
      fromExerciseId: from.id,
      toExerciseId: to.id,
      similarity,
      difference: difference.trim(),
      ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
      ...(caution.trim() ? { caution: caution.trim() } : {}),
      ...(to.primaryMuscles?.length ? { primaryMuscles: to.primaryMuscles } : {}),
      ...(to.movementPattern ? { movementPattern: to.movementPattern } : {}),
    }).then((result) => {
      if (result) {
        showToast(`已保存：${from.name} → ${to.name}`);
        onClose();
      } else {
        setError('保存失败，请检查两个动作');
      }
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={selecting ? (selecting === 'from' ? '选择原动作' : '选择替代动作') : '新建替代关系'}
      footer={
        selecting ? (
          <button
            type="button"
            onClick={() => {
              setSelecting(null);
              setKeyword('');
            }}
            className="tap w-full rounded-xl bg-surface-2 py-3 text-sm font-semibold text-muted"
          >
            返回
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存替代关系
          </button>
        )
      }
    >
      {selecting ? (
        <div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <IconSearch className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索动作"
              autoFocus
              autoComplete="off"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
          </div>
          <div className="mt-2 max-h-[52vh] space-y-1 overflow-y-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item.id)}
                className="tap flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left active:bg-surface-2"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-[10px] font-semibold text-accent">
                  {item.category}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{item.name}</span>
                {item.movementPattern ? (
                  <span className="shrink-0 text-[10px] text-muted">{item.movementPattern}</span>
                ) : null}
              </button>
            ))}
            {filtered.length === 0 ? <p className="px-2 py-3 text-xs text-muted">没有找到动作</p> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelecting('from')}
              className="tap rounded-xl border border-line bg-surface-2 p-2.5 text-left"
            >
              <span className="block text-[10px] text-muted">原动作</span>
              <span className="mt-0.5 block truncate text-[14px] font-medium">
                {from?.name ?? '点击选择'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelecting('to')}
              className="tap rounded-xl border border-line bg-surface-2 p-2.5 text-left"
            >
              <span className="block text-[10px] text-muted">替代动作</span>
              <span className="mt-0.5 block truncate text-[14px] font-medium">
                {to?.name ?? '点击选择'}
              </span>
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">相似程度</p>
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {(
                [
                  { value: 'close', label: '较接近' },
                  { value: 'partial', label: '部分替代' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSimilarity(option.value)}
                  className={`tap flex-1 rounded-lg py-2 text-sm font-medium ${
                    similarity === option.value ? 'bg-surface text-accent shadow-sm' : 'text-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              同一肌群但动作模式不同的，通常只能算「部分替代」。
            </p>
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="sub-diff">
              主要区别（必填）
            </label>
            <textarea
              id="sub-diff"
              value={difference}
              onChange={(event) => setDifference(event.target.value)}
              rows={3}
              maxLength={300}
              placeholder="例如：受力方向由垂直变为水平，背阔肌参与减少、上背参与增加"
              className="mt-1 w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="sub-equipment">
              所需器械（可选）
            </label>
            <input
              id="sub-equipment"
              value={equipment}
              onChange={(event) => setEquipment(event.target.value)}
              placeholder="例如：哑铃 / 绳索"
              maxLength={40}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="text-xs text-muted" htmlFor="sub-caution">
              注意事项（可选）
            </label>
            <input
              id="sub-caution"
              value={caution}
              onChange={(event) => setCaution(event.target.value)}
              placeholder="例如：重量过大容易用腰部代偿"
              maxLength={120}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
            />
          </div>

          {to?.movementPattern || to?.primaryMuscles?.length ? (
            <p className="rounded-xl bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
              将自动带上替代动作的信息：
              {to?.movementPattern ? `动作模式「${to.movementPattern}」` : ''}
              {to?.primaryMuscles?.length ? `，主要肌群「${to.primaryMuscles.join('、')}」` : ''}。
            </p>
          ) : null}

          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      )}
    </Sheet>
  );
}
