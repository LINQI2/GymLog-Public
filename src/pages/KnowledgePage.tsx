import { useMemo, useState } from 'react';
import { useGymLog, useToday } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { EmptyState } from '../components/ui';
import { useToast } from '../components/Toast';
import { TemplateSheet } from '../components/TemplateSheet';
import { TemplateEditorSheet } from '../components/TemplateEditorSheet';
import { ArticleSheet } from '../components/ArticleSheet';
import { SubstitutionSheet } from '../components/SubstitutionSheet';
import { SubstitutionEditorSheet } from '../components/SubstitutionEditorSheet';
import {
  IconArrowRight,
  IconBook,
  IconDumbbell,
  IconPlus,
  IconSearch,
  IconStar,
} from '../components/Icons';

type Section = 'templates' | 'substitutions' | 'articles' | 'favorites';

const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: 'templates', label: '训练方案' },
  { value: 'substitutions', label: '动作替代' },
  { value: 'articles', label: '健身原理' },
  { value: 'favorites', label: '我的收藏' },
];

export function KnowledgePage() {
  const { templates, articles, exercises, substitutions, createTemplate } = useGymLog();
  const { showToast } = useToast();
  const today = useToday();

  const [section, setSection] = useState<Section>('templates');
  const [keyword, setKeyword] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleCreating, setArticleCreating] = useState(false);
  const [subFrom, setSubFrom] = useState<{ id?: string; name: string } | null>(null);
  const [subEditorOpen, setSubEditorOpen] = useState(false);

  const query = keyword.trim().toLowerCase();

  const subCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of substitutions) {
      map.set(item.fromExerciseId, (map.get(item.fromExerciseId) ?? 0) + 1);
    }
    return map;
  }, [substitutions]);

  const filteredTemplates = useMemo(() => {
    if (!query) return templates;
    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.targetMuscles,
        template.description ?? '',
        ...template.exercises.map((item) => item.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [templates, query]);

  const filteredArticles = useMemo(() => {
    if (!query) return articles;
    return articles.filter((article) =>
      `${article.title} ${article.category} ${article.body}`.toLowerCase().includes(query),
    );
  }, [articles, query]);

  const filteredExercises = useMemo(() => {
    if (!query) return exercises;
    return exercises.filter((item) =>
      `${item.name} ${item.category} ${item.movementPattern ?? ''} ${item.equipment ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [exercises, query]);

  const favoriteTemplates = filteredTemplates.filter((item) => item.isFavorite);
  const favoriteArticles = filteredArticles.filter((item) => item.isFavorite);

  const handleCreateTemplate = async () => {
    const created = await createTemplate({ name: '新训练模板', targetMuscles: '', exercises: [] });
    setEditingTemplateId(created.id);
    showToast('已创建模板，先添加动作');
  };

  const handleCreate = () => {
    if (section === 'templates' || section === 'favorites') void handleCreateTemplate();
    else if (section === 'articles') {
      setArticleId(null);
      setArticleCreating(true);
    } else {
      setSubEditorOpen(true);
    }
  };

  const placeholder =
    section === 'templates'
      ? '搜索模板或动作'
      : section === 'substitutions'
        ? '搜索动作、器械或动作模式'
        : '搜索标题、分类或正文';

  return (
    <>
      <PageHeader
        title="知识"
        subtitle={`模板 ${templates.length} · 文章 ${articles.length} · 替代 ${substitutions.length}`}
        right={
          <button
            type="button"
            onClick={handleCreate}
            aria-label="新建"
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
            placeholder={placeholder}
            autoComplete="off"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </div>

        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {SECTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSection(item.value)}
              className={`tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                section === item.value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        {section === 'templates' ? (
          filteredTemplates.length === 0 ? (
            <EmptyState
              icon={<IconBook className="h-6 w-6" />}
              title={templates.length ? '没有匹配的训练模板' : '还没有训练模板'}
              description="模板只是可修改的起点：先建一个，把动作和大概的组数次数填进去，训练时一键加进当天。"
              action={
                <button
                  type="button"
                  onClick={() => void handleCreateTemplate()}
                  className="tap rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
                >
                  新建模板
                </button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className="card tap w-full p-3.5 text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold">{template.name}</span>
                        {template.builtin ? (
                          <span className="shrink-0 rounded bg-surface-2 px-1 py-0.5 text-[9px] text-muted">
                            示例
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {template.targetMuscles || '未填写目标肌群'} · {template.exercises.length} 个动作
                      </p>
                    </div>
                    {template.isFavorite ? (
                      <IconStar filled className="h-4 w-4 shrink-0 text-warn" />
                    ) : null}
                    <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  </div>
                  {template.description ? (
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {template.description}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          )
        ) : null}

        {section === 'substitutions' ? (
          <>
            <button
              type="button"
              onClick={() => setSubEditorOpen(true)}
              className="tap mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-xs font-medium text-muted"
            >
              <IconPlus className="h-4 w-4" />
              新建替代关系（全部保存在本机）
            </button>

            {filteredExercises.length === 0 ? (
              <EmptyState icon={<IconDumbbell className="h-6 w-6" />} title="没有匹配的动作" />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {filteredExercises.map((item) => {
                  const count = subCount.get(item.id) ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSubFrom({ id: item.id, name: item.name })}
                      className="tap flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-surface-2"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-[10px] font-semibold text-accent">
                        {item.category}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{item.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {item.movementPattern ? `${item.movementPattern} · ` : ''}
                          {item.equipment ? `${item.equipment} · ` : ''}
                          {count > 0 ? `${count} 个替代` : '暂无替代'}
                        </span>
                      </span>
                      <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {section === 'articles' ? (
          filteredArticles.length === 0 ? (
            <EmptyState
              icon={<IconBook className="h-6 w-6" />}
              title={articles.length ? '没有匹配的文章' : '还没有知识文章'}
              description="内容保存在本机，可随时编辑；涉及身体状况的内容请以专业意见为准。"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setArticleId(null);
                    setArticleCreating(true);
                  }}
                  className="tap rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
                >
                  新建文章
                </button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredArticles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => {
                    setArticleCreating(false);
                    setArticleId(article.id);
                  }}
                  className="card tap w-full p-3.5 text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold leading-snug">{article.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                          {article.category}
                        </span>
                        {article.needsReview ? (
                          <span className="rounded bg-warn/15 px-1.5 py-0.5 font-medium text-warn">
                            待审核
                          </span>
                        ) : null}
                        <span>{article.updatedAt.slice(0, 10)}</span>
                      </p>
                    </div>
                    {article.isFavorite ? (
                      <IconStar filled className="h-4 w-4 shrink-0 text-warn" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {section === 'favorites' ? (
          <div className="space-y-4">
            <section>
              <h2 className="mb-1.5 text-xs font-semibold text-muted">收藏的模板</h2>
              {favoriteTemplates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted">
                  还没有收藏模板。在模板详情里点「收藏」即可出现在这里。
                </p>
              ) : (
                <div className="space-y-2">
                  {favoriteTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setTemplateId(template.id)}
                      className="card tap flex w-full items-center gap-2 p-3 text-left"
                    >
                      <IconStar filled className="h-4 w-4 shrink-0 text-warn" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{template.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {template.targetMuscles || '未填写目标肌群'} · {template.exercises.length} 个动作
                        </span>
                      </span>
                      <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-1.5 text-xs font-semibold text-muted">收藏的文章</h2>
              {favoriteArticles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted">
                  还没有收藏文章。阅读时点「收藏」即可。
                </p>
              ) : (
                <div className="space-y-2">
                  {favoriteArticles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => {
                        setArticleCreating(false);
                        setArticleId(article.id);
                      }}
                      className="card tap flex w-full items-center gap-2 p-3 text-left"
                    >
                      <IconStar filled className="h-4 w-4 shrink-0 text-warn" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{article.title}</span>
                        <span className="block text-[11px] text-muted">{article.category}</span>
                      </span>
                      <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>

      <TemplateSheet
        open={templateId !== null}
        onClose={() => setTemplateId(null)}
        templateId={templateId}
        date={today}
      />

      <TemplateEditorSheet
        open={editingTemplateId !== null}
        onClose={() => setEditingTemplateId(null)}
        templateId={editingTemplateId}
      />

      <ArticleSheet
        open={articleId !== null || articleCreating}
        onClose={() => {
          setArticleId(null);
          setArticleCreating(false);
        }}
        articleId={articleId}
        creating={articleCreating}
      />

      <SubstitutionSheet
        open={subFrom !== null}
        onClose={() => setSubFrom(null)}
        from={subFrom}
      />

      <SubstitutionEditorSheet
        open={subEditorOpen}
        onClose={() => setSubEditorOpen(false)}
        presetFromId={subFrom?.id}
      />
    </>
  );
}
