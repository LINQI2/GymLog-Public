import { useEffect, useMemo, useState } from 'react';
import { useGymLog } from '../store/gymlog';
import { ConfirmDialog, Sheet } from './ui';
import { useToast } from './Toast';
import { IconCheck, IconExternal, IconPencil, IconStar, IconTrash } from './Icons';
import { checkLinkUrl, linkTitle, openExternalUrl } from '../lib/links';
import { nowISO } from '../lib/date';
import { ARTICLE_CATEGORIES, type ArticleCategory, type ExerciseLink } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 传 null 且 creating=true 表示新建 */
  articleId: string | null;
  creating?: boolean;
}

export function ArticleSheet({ open, onClose, articleId, creating = false }: Props) {
  const { articles, exercises, createArticle, updateArticle, deleteArticle } = useGymLog();
  const { showToast } = useToast();
  const article = articles.find((item) => item.id === articleId) ?? null;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('训练基础');
  const [body, setBody] = useState('');
  const [linkTitleText, setLinkTitleText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    if (creating) {
      setEditing(true);
      setTitle('');
      setCategory('训练基础');
      setBody('');
      setLinkTitleText('');
      setLinkUrl('');
      setExerciseIds([]);
      return;
    }
    if (!article) return;
    setEditing(false);
    setTitle(article.title);
    setCategory(article.category);
    setBody(article.body);
    setLinkTitleText(article.link?.title ?? '');
    setLinkUrl(article.link?.url ?? '');
    setExerciseIds(article.exerciseIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, articleId, creating]);

  const linkedExercises = useMemo(
    () => (article?.exerciseIds ?? []).map((id) => exercises.find((item) => item.id === id)).filter(Boolean),
    [article, exercises],
  );

  if (!open) return null;
  if (!creating && !article) return null;

  const save = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('请填写标题');
      return;
    }
    let link: ExerciseLink | undefined;
    if (linkUrl.trim()) {
      const checked = checkLinkUrl(linkUrl);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
      link = {
        id: article?.link?.id ?? `link-${nowISO()}`,
        title: linkTitleText.trim(),
        url: checked.url,
      };
    }
    setError(null);

    if (creating || !article) {
      void createArticle({
        title: trimmedTitle,
        category,
        body,
        ...(link ? { link } : {}),
        exerciseIds,
      }).then(() => {
        showToast('已保存文章');
        onClose();
      });
      return;
    }

    void updateArticle(article.id, {
      title: trimmedTitle,
      category,
      body,
      link,
      exerciseIds,
    }).then(() => {
      showToast('已保存文章');
      setEditing(false);
    });
  };

  const footer = editing ? (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          if (creating) onClose();
          else setEditing(false);
        }}
        className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted"
      >
        取消
      </button>
      <button
        type="button"
        onClick={save}
        className="tap flex-[1.4] rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
      >
        保存
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (!article) return;
          void updateArticle(article.id, { isFavorite: !article.isFavorite });
        }}
        className={`tap flex items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold ${
          article?.isFavorite ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line text-muted'
        }`}
      >
        <IconStar filled={article?.isFavorite} className="h-4 w-4" />
        {article?.isFavorite ? '已收藏' : '收藏'}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
      >
        <IconPencil className="h-4 w-4" />
        编辑
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label="删除文章"
        className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-danger/40 text-danger"
      >
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      <Sheet open={open} onClose={onClose} title={creating ? '新建文章' : '知识文章'} footer={footer}>
        {editing ? (
          <div className="space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="标题，例如：三角肌中束的作用"
              maxLength={60}
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] font-medium outline-none focus:border-accent"
            />

            <div>
              <p className="mb-1.5 text-xs text-muted">分类</p>
              <div className="flex flex-wrap gap-1.5">
                {ARTICLE_CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`tap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      category === item
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-2 text-muted'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted">
                正文（支持「## 小标题」「- 列表」，空行分段）
              </p>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                placeholder={'## 小标题\n- 要点\n\n普通段落'}
                className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted">教学链接（可选）</p>
              <input
                value={linkTitleText}
                onChange={(event) => setLinkTitleText(event.target.value)}
                placeholder="链接标题，例如：动作讲解"
                maxLength={40}
                autoComplete="off"
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
              />
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="粘贴链接或分享文案"
                autoComplete="off"
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted">关联动作（可多选）</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {exercises.map((item) => {
                  const active = exerciseIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setExerciseIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id],
                        )
                      }
                      className={`tap flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        active
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface-2 text-muted'
                      }`}
                    >
                      {active ? <IconCheck className="h-3 w-3" /> : null}
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </div>
        ) : article ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 text-[17px] font-bold leading-snug">{article.title}</h2>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                  {article.category}
                </span>
                <span>更新于 {article.updatedAt.slice(0, 10)}</span>
                {article.needsReview ? (
                  <span className="rounded-md bg-warn/15 px-1.5 py-0.5 font-medium text-warn">待审核</span>
                ) : null}
              </div>
            </div>

            <ArticleBody body={article.body} />

            {article.link ? (
              <button
                type="button"
                onClick={() => openExternalUrl(article.link?.url ?? '')}
                className="tap flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left"
              >
                <IconExternal className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {linkTitle(article.link)}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{article.link.url}</span>
                </span>
              </button>
            ) : null}

            {linkedExercises.length ? (
              <div>
                <p className="mb-1.5 text-xs text-muted">关联动作</p>
                <div className="flex flex-wrap gap-1.5">
                  {linkedExercises.map((item) =>
                    item ? (
                      <span
                        key={item.id}
                        className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted"
                      >
                        {item.name}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted">
              内容为一般性训练常识，不构成医疗建议；无法充分验证的表述会标记「待审核」。
            </p>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这篇知识文章？"
        description="只删除文章内容，不会影响任何训练记录。"
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!article) return;
          setConfirmDelete(false);
          void deleteArticle(article.id);
          onClose();
          showToast('已删除文章');
        }}
      />
    </>
  );
}

/** 极简 Markdown 子集：## 小标题 / - 列表 / 段落 */
export function ArticleBody({ body }: { body: string }) {
  const lines = body.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const text = line.replace(/\s+$/, '');
        if (!text.trim()) return <div key={index} className="h-2" />;
        if (text.startsWith('## ')) {
          return (
            <h3 key={index} className="pt-1.5 text-[14px] font-semibold text-ink">
              {text.slice(3)}
            </h3>
          );
        }
        if (text.startsWith('- ')) {
          return (
            <p key={index} className="flex gap-1.5 text-[13.5px] leading-relaxed text-ink">
              <span className="text-accent">·</span>
              <span className="min-w-0 flex-1">{text.slice(2)}</span>
            </p>
          );
        }
        return (
          <p key={index} className="text-[13.5px] leading-relaxed text-ink">
            {text}
          </p>
        );
      })}
    </div>
  );
}
