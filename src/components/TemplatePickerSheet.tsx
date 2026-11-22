import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { Sheet } from './ui';
import { IconArrowRight, IconBook, IconSearch, IconStar } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (templateId: string) => void;
}

/** 今日训练里的「训练方案」入口：选一个模板后进入勾选/预览 */
export function TemplatePickerSheet({ open, onClose, onPick }: Props) {
  const { templates } = useGymLog();
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (open) setKeyword('');
  }, [open]);

  const query = keyword.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return templates;
    return templates.filter((template) =>
      [
        template.name,
        template.targetMuscles,
        template.description ?? '',
        ...template.exercises.map((item) => item.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [templates, query]);

  return (
    <Sheet open={open} onClose={onClose} title="选择训练方案">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
        <IconSearch className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索模板或动作"
          autoComplete="off"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line-strong p-4 text-center">
          <p className="text-sm font-medium">
            {templates.length ? '没有匹配的训练方案' : '还没有训练方案'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            可以在底部「知识 → 训练方案」里新建模板，或把今天的动作列表直接存为模板。
          </p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {filtered.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template.id)}
              className="tap flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left active:bg-surface-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <IconBook className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold">{template.name}</span>
                  {template.isFavorite ? (
                    <IconStar filled className="h-3.5 w-3.5 shrink-0 text-warn" />
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {template.targetMuscles || '未填写目标肌群'} · {template.exercises.length} 个动作
                </span>
              </span>
              <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        选择方案后可以勾选要做的动作，确认前会预览；只创建动作卡片，不生成已完成的组。
      </p>
    </Sheet>
  );
}
