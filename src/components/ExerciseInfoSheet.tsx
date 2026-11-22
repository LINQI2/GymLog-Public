import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import type { ExerciseCatalogItem, ExerciseLink } from '../types';
import { EQUIPMENT_OPTIONS, MOVEMENT_PATTERNS } from '../types';
import { Sheet } from './ui';
import { useToast } from './Toast';
import { SubstitutionSheet } from './SubstitutionSheet';
import {
  IconArrowRight,
  IconBook,
  IconExternal,
  IconLink,
  IconPlus,
  IconTrash,
} from './Icons';
import { uid } from '../lib/id';
import {
  DESCRIPTION_MAX,
  LINK_TITLE_MAX,
  LINK_URL_MAX,
  LINKS_MAX,
  checkLinkUrl,
  detectPlatform,
  linkTitle,
  openExternalUrl,
  platformLabel,
} from '../lib/links';

interface DraftLink {
  id: string;
  title: string;
  url: string;
}

interface InfoPatch {
  description?: string;
  links: ExerciseLink[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  movementPattern?: string;
  equipment?: string;
  steps?: string;
  commonMistakes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 动作用于展示的名称（历史记录可能已经没有对应动作库条目） */
  name: string;
  exercise: ExerciseCatalogItem | null;
  /** 是否可编辑（动作管理页为 true，训练页默认只读） */
  editable?: boolean;
  onSave?: (patch: InfoPatch) => void;
  /** 训练页传入时，替代按钮交给调用方处理 */
  onOpenSubstitution?: () => void;
}

function toDrafts(links: ExerciseLink[] | undefined): DraftLink[] {
  return (links ?? []).map((link) => ({ id: link.id, title: link.title, url: link.url }));
}

/** 逗号（中英文）或顿号分隔的肌群列表 */
function parseList(value: string): string[] {
  return value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function ExerciseInfoSheet({
  open,
  onClose,
  name,
  exercise,
  editable = false,
  onSave,
  onOpenSubstitution,
}: Props) {
  const { showToast } = useToast();
  const { articles, templates, substitutions } = useGymLog();
  const [description, setDescription] = useState('');
  const [drafts, setDrafts] = useState<DraftLink[]>([]);
  const [primaryText, setPrimaryText] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [pattern, setPattern] = useState('');
  const [equipment, setEquipment] = useState('');
  const [steps, setSteps] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);

  // 每次打开时按最新数据重置草稿，避免切换动作后串数据
  useEffect(() => {
    if (!open) return;
    setDescription(exercise?.description ?? '');
    setDrafts(toDrafts(exercise?.links));
    setPrimaryText((exercise?.primaryMuscles ?? []).join('、'));
    setSecondaryText((exercise?.secondaryMuscles ?? []).join('、'));
    setPattern(exercise?.movementPattern ?? '');
    setEquipment(exercise?.equipment ?? '');
    setSteps(exercise?.steps ?? '');
    setMistakes(exercise?.commonMistakes ?? '');
    setError(null);
    setSubOpen(false);
  }, [open, exercise]);

  const relatedArticles = useMemo(
    () =>
      exercise
        ? articles.filter((article) => article.exerciseIds?.includes(exercise.id))
        : [],
    [articles, exercise],
  );

  const relatedTemplates = useMemo(
    () =>
      exercise
        ? templates.filter((template) =>
            template.exercises.some(
              (item) => item.exerciseId === exercise.id || item.name === exercise.name,
            ),
          )
        : [],
    [templates, exercise],
  );

  const substituteCount = useMemo(
    () =>
      exercise ? substitutions.filter((item) => item.fromExerciseId === exercise.id).length : 0,
    [substitutions, exercise],
  );

  const hasInfoFields = Boolean(
    exercise?.primaryMuscles?.length ||
      exercise?.secondaryMuscles?.length ||
      exercise?.movementPattern ||
      exercise?.equipment ||
      exercise?.steps ||
      exercise?.commonMistakes,
  );

  const handleOpen = (url: string, title: string) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('当前没有网络，视频/网页需要联网才能看；文字简介仍可查看');
      return;
    }
    if (!openExternalUrl(url)) {
      showToast('这个链接无效，已被拦截');
      return;
    }
    const isApp = /^(snssdk1128|douyin|bilibili|xhs):/i.test(url);
    showToast(
      isApp
        ? `正在唤起对应 App${title ? `「${title}」` : ''}，没反应说明还没安装`
        : `正在用外部浏览器打开${title ? `「${title}」` : ''}`,
    );
  };

  const handleSave = () => {
    const cleaned: ExerciseLink[] = [];
    for (const draft of drafts) {
      const url = draft.url.trim();
      const title = draft.title.trim().slice(0, LINK_TITLE_MAX);
      if (!url) continue;
      const checked = checkLinkUrl(url);
      if (!checked.ok) {
        setError(`「${title || url}」${checked.error}`);
        return;
      }
      cleaned.push({ id: draft.id || uid(), title, url: checked.url });
    }
    setError(null);
    onSave?.({
      description: description.trim() ? description.trim().slice(0, DESCRIPTION_MAX) : undefined,
      links: cleaned,
      primaryMuscles: parseList(primaryText),
      secondaryMuscles: parseList(secondaryText),
      movementPattern: pattern || undefined,
      equipment: equipment || undefined,
      steps: steps.trim() || undefined,
      commonMistakes: mistakes.trim() || undefined,
    });
    showToast('已保存动作资料');
    onClose();
  };

  const openSubstitution = () => {
    if (onOpenSubstitution) {
      onOpenSubstitution();
      return;
    }
    setSubOpen(true);
  };

  const readonlyContent = (
    <div className="space-y-4">
      {hasInfoFields ? (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <IconBook className="h-4 w-4" />
            动作信息
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <InfoBox label="主要肌群" value={exercise?.primaryMuscles?.join('、')} />
            <InfoBox label="辅助肌群" value={exercise?.secondaryMuscles?.join('、')} />
            <InfoBox label="动作模式" value={exercise?.movementPattern} />
            <InfoBox label="器械" value={exercise?.equipment} />
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <IconBook className="h-4 w-4" />
          动作简介
        </h3>
        {exercise?.description ? (
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[14px] leading-relaxed">
            {exercise.description}
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">
            还没有简介。可以到「动作管理」里给这个动作补充要点。
          </p>
        )}
      </section>

      {exercise?.steps ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">动作步骤</h3>
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed">
            {exercise.steps}
          </p>
        </section>
      ) : null}

      {exercise?.commonMistakes ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">常见错误</h3>
          <p className="whitespace-pre-wrap rounded-xl bg-warn/10 p-3 text-[13px] leading-relaxed">
            {exercise.commonMistakes}
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <IconLink className="h-4 w-4" />
          教学链接
        </h3>
        {exercise?.links && exercise.links.length > 0 ? (
          <div className="space-y-2">
            {exercise.links.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleOpen(link.url, link.title)}
                className="tap flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <IconExternal className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{linkTitle(link)}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {platformLabel(detectPlatform(link.url))} · {link.url}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">
            还没有教学链接。可以到「动作管理」里添加，例如「谭成义教学」「动作注意事项」。
          </p>
        )}
      </section>

      {exercise ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">替代动作</h3>
          <button
            type="button"
            onClick={openSubstitution}
            className="tap flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <IconArrowRight className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">
                {substituteCount > 0 ? `${substituteCount} 个替代动作` : '查找替代动作'}
              </span>
              <span className="block text-[11px] text-muted">器械被占用或动作不适合时使用</span>
            </span>
            <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </section>
      ) : null}

      {relatedArticles.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">关联知识</h3>
          <div className="space-y-1.5">
            {relatedArticles.map((article) => (
              <p
                key={article.id}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]"
              >
                {article.title}
                <span className="ml-1.5 text-[10px] text-muted">{article.category}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {relatedTemplates.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">所属训练模板</h3>
          <div className="flex flex-wrap gap-1.5">
            {relatedTemplates.map((template) => (
              <span
                key={template.id}
                className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted"
              >
                {template.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted">
        链接会交给系统浏览器或对应 App 打开，不会在 GymLog 内嵌网页。没有网络时只有文字内容可查看。
      </p>
    </div>
  );

  const editContent = (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <IconBook className="h-4 w-4" />
          动作简介
        </h3>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={DESCRIPTION_MAX}
          placeholder="动作要点、发力感受、常见错误等，可留空"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-accent"
        />
        <p className="mt-1 text-right text-[11px] text-muted">
          {description.length}/{DESCRIPTION_MAX}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted">动作信息（可选）</h3>
        <input
          value={primaryText}
          onChange={(event) => setPrimaryText(event.target.value)}
          placeholder="主要肌群，用顿号分隔：三角肌中束、冈上肌"
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <input
          value={secondaryText}
          onChange={(event) => setSecondaryText(event.target.value)}
          placeholder="辅助肌群，例如：斜方肌、前锯肌"
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
        />

        <p className="pt-1 text-[11px] text-muted">动作模式</p>
        <div className="flex flex-wrap gap-1.5">
          {MOVEMENT_PATTERNS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPattern(pattern === item ? '' : item)}
              className={`tap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                pattern === item
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface-2 text-muted'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <p className="pt-1 text-[11px] text-muted">器械类型</p>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setEquipment(equipment === item ? '' : item)}
              className={`tap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                equipment === item
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface-2 text-muted'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <p className="pt-1 text-[11px] text-muted">动作步骤</p>
        <textarea
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          rows={4}
          maxLength={800}
          placeholder="1. 调整座椅高度…&#10;2. 保持肩胛稳定…"
          className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
        />

        <p className="pt-1 text-[11px] text-muted">常见错误</p>
        <textarea
          value={mistakes}
          onChange={(event) => setMistakes(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="例如：耸肩借力、下背离开靠垫"
          className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
        />
      </section>

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <IconLink className="h-4 w-4" />
          教学链接（最多 {LINKS_MAX} 个）
        </h3>
        <div className="space-y-2">
          {drafts.map((draft, index) => (
            <div key={draft.id} className="rounded-xl border border-line bg-surface-2 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={draft.title}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, title: value } : item)),
                    );
                  }}
                  maxLength={LINK_TITLE_MAX}
                  placeholder="标题（可选），例如：谭成义教学"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-[16px] outline-none focus:border-accent"
                />
                <button
                  type="button"
                  aria-label="删除这个链接"
                  onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                  className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg text-danger"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <input
                value={draft.url}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, url: value } : item)),
                  );
                }}
                maxLength={LINK_URL_MAX}
                inputMode="url"
                type="text"
                placeholder="粘贴链接或整段分享文案，如 v.douyin.com/xxx"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="mt-2 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[15px] outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>

        {drafts.length < LINKS_MAX ? (
          <button
            type="button"
            onClick={() => setDrafts((prev) => [...prev, { id: uid(), title: '', url: '' }])}
            className="tap mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-sm font-medium text-muted"
          >
            <IconPlus className="h-4 w-4" />
            添加链接
          </button>
        ) : null}

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          只影响动作资料，不会改动任何训练记录。简介和链接可以只填一种，也可以都留空（清空资料）。
        </p>
      </section>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`${name} · ${editable ? '编辑动作资料' : '动作资料'}`}
        footer={
          editable ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="tap flex-[1.4] rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
              >
                保存
              </button>
            </div>
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
        {editable ? editContent : readonlyContent}
      </Sheet>

      <SubstitutionSheet
        open={subOpen}
        onClose={() => setSubOpen(false)}
        from={exercise ? { id: exercise.id, name: exercise.name } : null}
      />
    </>
  );
}

function InfoBox({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2.5 py-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-medium leading-snug">{value || '—'}</div>
    </div>
  );
}
