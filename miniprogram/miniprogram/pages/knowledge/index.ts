import {
  createTemplate,
  listArticles,
  listSubstitutions,
  listTemplates,
  substitutionCountMap,
} from '../../utils/knowledge';
import { listExercises } from '../../utils/store';

Page({
  data: {
    sections: [
      { value: 'templates', label: '训练方案' },
      { value: 'substitutions', label: '动作替代' },
      { value: 'articles', label: '健身原理' },
      { value: 'favorites', label: '我的收藏' },
    ],
    section: 'templates',
    keyword: '',
    templates: [] as any[],
    articles: [] as any[],
    exercises: [] as any[],
    favTemplates: [] as any[],
    favArticles: [] as any[],
    counts: { templates: 0, articles: 0, substitutions: 0 },
    pickerOpen: false,
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 3 });
    this.refresh();
  },

  refresh() {
    const keyword = this.data.keyword.trim().toLowerCase();
    const match = (text: string) => !keyword || text.toLowerCase().indexOf(keyword) >= 0;

    const templates = listTemplates()
      .filter((item) =>
        match(
          [item.name, item.targetMuscles, item.description || '', ...item.exercises.map((e) => e.name)].join(
            ' ',
          ),
        ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        isFavorite: item.isFavorite,
        builtin: item.builtin === true,
        subText: `${item.targetMuscles || '未填写目标肌群'} · ${item.exercises.length} 个动作`,
        description: item.description || '',
        preview: item.exercises.map((exercise) => exercise.name).join(' · '),
      }));

    const articles = listArticles()
      .filter((item) => match(`${item.title} ${item.category} ${item.body}`))
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        isFavorite: item.isFavorite,
        needsReview: item.needsReview === true,
        dateText: (item.updatedAt || '').slice(0, 10),
      }));

    const counts = substitutionCountMap();
    const exercises = listExercises()
      .filter((item) => match(`${item.name} ${item.category} ${item.movementPattern || ''}`))
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        movementPattern: item.movementPattern || '',
        subCount: counts[item.id] || 0,
      }));

    this.setData({
      templates,
      articles,
      exercises,
      favTemplates: templates.filter((item) => item.isFavorite),
      favArticles: articles.filter((item) => item.isFavorite),
      counts: {
        templates: listTemplates().length,
        articles: listArticles().length,
        substitutions: listSubstitutions().length,
      },
    });
  },

  onSection(e: any) {
    this.setData({ section: e.currentTarget.dataset.value }, () => this.refresh());
  },

  onSearch(e: any) {
    this.setData({ keyword: e.detail.value }, () => this.refresh());
  },

  openTemplate(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/template/index?id=${id}` });
  },

  openArticle(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/article/index?id=${id}` });
  },

  openExercise(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/exercise-info/index?id=${id}` });
  },

  createTemplate() {
    wx.showModal({
      title: '新建训练方案',
      editable: true,
      placeholderText: '例如：肩部训练',
      success: (res: any) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim();
        if (!name) {
          wx.showToast({ title: '请输入方案名称', icon: 'none' });
          return;
        }
        const template = createTemplate({ name, targetMuscles: '', exercises: [] });
        wx.navigateTo({ url: `/pages/template/index?id=${template.id}&edit=1` });
      },
    });
  },

  createArticle() {
    wx.navigateTo({ url: '/pages/article/index' });
  },

  pickForSubstitution() {
    this.setData({ pickerOpen: true });
  },

  onPickExercise(e: any) {
    const { id } = e.detail;
    this.setData({ pickerOpen: false });
    wx.navigateTo({ url: `/pages/exercise-info/index?id=${id}&addSub=1` });
  },

  closePicker() {
    this.setData({ pickerOpen: false });
  },

  onCreate() {
    if (this.data.section === 'templates' || this.data.section === 'favorites') this.createTemplate();
    else if (this.data.section === 'articles') this.createArticle();
    else this.pickForSubstitution();
  },
});
