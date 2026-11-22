import { ARTICLE_CATEGORIES, type ArticleCategory, type ExerciseLink } from '../../utils/types';
import {
  createArticle,
  deleteArticle,
  getArticle,
  toggleArticleFavorite,
  updateArticle,
} from '../../utils/knowledge';
import { listExercises } from '../../utils/store';
import { copyLink, linkTitle, normalizeLink, platformLabel } from '../../utils/links';

interface Block {
  type: 'h' | 'p' | 'li' | 'gap';
  text: string;
}

function toBlocks(body: string): Block[] {
  const lines = (body || '').split('\n');
  const blocks: Block[] = [];
  lines.forEach((line) => {
    const text = line.replace(/\s+$/, '');
    if (!text.trim()) {
      blocks.push({ type: 'gap', text: '' });
      return;
    }
    if (text.indexOf('## ') === 0) {
      blocks.push({ type: 'h', text: text.slice(3) });
      return;
    }
    if (text.indexOf('- ') === 0) {
      blocks.push({ type: 'li', text: text.slice(2) });
      return;
    }
    blocks.push({ type: 'p', text });
  });
  return blocks;
}

Page({
  data: {
    id: '',
    creating: false,
    editing: false,
    article: null as any,
    blocks: [] as Block[],
    categories: ARTICLE_CATEGORIES,
    exercises: [] as any[],
    title: '',
    category: '训练基础' as ArticleCategory,
    body: '',
    linkTitle: '',
    linkUrl: '',
    exerciseIds: [] as string[],
    error: '',
    linkText: '',
    linkPlatform: '',
  },

  onLoad(options: any) {
    const id = options && options.id ? options.id : '';
    this.setData({ exercises: listExercises().map((item) => ({ id: item.id, name: item.name })) });
    if (!id) {
      this.setData({ creating: true, editing: true });
      return;
    }
    this.setData({ id });
    this.load();
  },

  load() {
    const article = getArticle(this.data.id);
    if (!article) {
      wx.showToast({ title: '文章不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({
      article,
      blocks: toBlocks(article.body),
      title: article.title,
      category: article.category,
      body: article.body,
      linkTitle: article.link ? article.link.title : '',
      linkUrl: article.link ? article.link.url : '',
      exerciseIds: article.exerciseIds || [],
      linkText: article.link ? linkTitle(article.link) : '',
      linkPlatform: article.link ? platformLabel(article.link.url) : '',
      error: '',
    });
  },

  startEdit() {
    this.setData({ editing: true });
  },

  cancelEdit() {
    if (this.data.creating) {
      wx.navigateBack();
      return;
    }
    this.setData({ editing: false, error: '' }, () => this.load());
  },

  onTitle(e: any) {
    this.setData({ title: e.detail.value });
  },

  onBody(e: any) {
    this.setData({ body: e.detail.value });
  },

  onLinkTitle(e: any) {
    this.setData({ linkTitle: e.detail.value });
  },

  onLinkUrl(e: any) {
    this.setData({ linkUrl: e.detail.value });
  },

  onCategory(e: any) {
    this.setData({ category: e.currentTarget.dataset.value });
  },

  toggleExercise(e: any) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.exerciseIds.slice();
    const index = list.indexOf(id);
    if (index >= 0) list.splice(index, 1);
    else list.push(id);
    this.setData({ exerciseIds: list });
  },

  save() {
    const title = this.data.title.trim();
    if (!title) {
      this.setData({ error: '请填写标题' });
      return;
    }
    let link: ExerciseLink | undefined;
    const rawUrl = this.data.linkUrl.trim();
    if (rawUrl) {
      const checked = normalizeLink(rawUrl);
      if (!checked.ok) {
        this.setData({ error: checked.error || '链接不正确' });
        return;
      }
      link = {
        id: (this.data.article && this.data.article.link && this.data.article.link.id) || `link-${Date.now()}`,
        title: this.data.linkTitle.trim().slice(0, 40),
        url: checked.url,
      };
    }

    if (this.data.creating) {
      const article = createArticle({
        title,
        category: this.data.category,
        body: this.data.body,
        ...(link ? { link } : {}),
        exerciseIds: this.data.exerciseIds,
      });
      wx.showToast({ title: '已保存', icon: 'none' });
      wx.redirectTo({ url: `/pages/article/index?id=${article.id}` });
      return;
    }

    updateArticle(this.data.id, {
      title,
      category: this.data.category,
      body: this.data.body,
      link,
      exerciseIds: this.data.exerciseIds,
    });
    this.setData({ editing: false, error: '' }, () => this.load());
    wx.showToast({ title: '已保存', icon: 'none' });
  },

  toggleFavorite() {
    toggleArticleFavorite(this.data.id);
    this.load();
  },

  remove() {
    wx.showModal({
      title: '删除这篇文章？',
      content: '只删除文章内容，不会影响训练记录。',
      confirmText: '删除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        deleteArticle(this.data.id);
        wx.navigateBack();
      },
    });
  },

  copyArticleLink() {
    const article = this.data.article;
    if (!article || !article.link) return;
    copyLink(article.link.url);
  },
});
