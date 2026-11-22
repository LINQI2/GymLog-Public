import {
  EQUIPMENT_OPTIONS,
  MOVEMENT_PATTERNS,
  type ExerciseCatalogItem,
  type ExerciseLink,
} from '../../utils/types';
import { getExercise, listExercises, updateExercise } from '../../utils/store';
import {
  articlesForExercise,
  createSubstitution,
  deleteSubstitution,
  substitutionTargets,
  templatesForExercise,
} from '../../utils/knowledge';
import { copyLink, linkTitle, LINK_TITLE_MAX, LINKS_MAX, normalizeLink } from '../../utils/links';
import { uid } from '../../utils/id';

function splitList(value: string): string[] {
  return (value || '')
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

Page({
  data: {
    id: '',
    name: '',
    exercise: null as ExerciseCatalogItem | null,
    editing: false,
    description: '',
    links: [] as ExerciseLink[],
    primaryText: '',
    secondaryText: '',
    pattern: '',
    equipment: '',
    steps: '',
    mistakes: '',
    patterns: MOVEMENT_PATTERNS,
    equipments: EQUIPMENT_OPTIONS,
    articles: [] as any[],
    templates: [] as any[],
    subTargets: [] as any[],
    pickerOpen: false,
    subOpen: false,
    subTo: null as any,
    similarity: 'close' as 'close' | 'partial',
    subDifference: '',
    subEquipment: '',
    subCaution: '',
    error: '',
    linkTitle: '',
    linkUrl: '',
  },

  onLoad(options: any) {
    const id = options && options.id ? options.id : '';
    const name = options && options.name ? decodeURIComponent(options.name) : '';
    this.setData({ id, name }, () => this.load());
    if (options && options.addSub === '1') {
      this.setData({ pickerOpen: true });
    }
  },

  onShow() {
    // 编辑中被其他页面打断（例如去看关联文章）时不要覆盖未保存的内容
    if (this.data.editing) return;
    if (this.data.id || this.data.name) this.load();
  },

  load() {
    const exercise = this.data.id
      ? getExercise(this.data.id)
      : listExercises().find((item) => item.name === this.data.name) || null;
    if (!exercise) {
      wx.setNavigationBarTitle({ title: '动作资料' });
      this.setData({ exercise: null });
      return;
    }
    this.setData({
      exercise,
      name: exercise.name,
      description: exercise.description || '',
      links: (exercise.links || []).map((item) => ({ ...item })),
      primaryText: (exercise.primaryMuscles || []).join('、'),
      secondaryText: (exercise.secondaryMuscles || []).join('、'),
      pattern: exercise.movementPattern || '',
      equipment: exercise.equipment || '',
      steps: exercise.steps || '',
      mistakes: exercise.commonMistakes || '',
      articles: articlesForExercise(exercise.id).map((item) => ({ id: item.id, title: item.title })),
      templates: templatesForExercise({ id: exercise.id, name: exercise.name }).map((item) => ({
        id: item.id,
        name: item.name,
      })),
      subTargets: substitutionTargets(exercise.id).map((row) => ({
        ...row,
        key: row.substitution.id,
      })),
      error: '',
    });
    wx.setNavigationBarTitle({ title: exercise.name });
  },

  /* ---------- 编辑 ---------- */

  startEdit() {
    if (!this.data.exercise) {
      wx.showToast({ title: '动作库里没有这个动作', icon: 'none' });
      return;
    }
    this.setData({ editing: true });
  },

  cancelEdit() {
    this.setData({ editing: false, error: '' }, () => this.load());
  },

  onDesc(e: any) {
    this.setData({ description: e.detail.value });
  },

  onPrimary(e: any) {
    this.setData({ primaryText: e.detail.value });
  },

  onSecondary(e: any) {
    this.setData({ secondaryText: e.detail.value });
  },

  onPattern(e: any) {
    const value = e.currentTarget.dataset.value;
    this.setData({ pattern: this.data.pattern === value ? '' : value });
  },

  onEquipment(e: any) {
    const value = e.currentTarget.dataset.value;
    this.setData({ equipment: this.data.equipment === value ? '' : value });
  },

  onSteps(e: any) {
    this.setData({ steps: e.detail.value });
  },

  onMistakes(e: any) {
    this.setData({ mistakes: e.detail.value });
  },

  onLinkTitle(e: any) {
    this.setData({ linkTitle: e.detail.value });
  },

  onLinkUrl(e: any) {
    this.setData({ linkUrl: e.detail.value });
  },

  addLink() {
    const raw = this.data.linkUrl.trim();
    if (!raw) {
      this.setData({ error: '请粘贴链接或分享文案' });
      return;
    }
    if (this.data.links.length >= LINKS_MAX) {
      this.setData({ error: `最多 ${LINKS_MAX} 个链接` });
      return;
    }
    const checked = normalizeLink(raw);
    if (!checked.ok) {
      this.setData({ error: checked.error || '链接无效' });
      return;
    }
    this.setData({
      links: [
        ...this.data.links,
        {
          id: uid(),
          title: this.data.linkTitle.trim().slice(0, LINK_TITLE_MAX),
          url: checked.url,
        },
      ],
      linkTitle: '',
      linkUrl: '',
      error: '',
    });
  },

  removeLink(e: any) {
    const id = e.currentTarget.dataset.id;
    this.setData({ links: this.data.links.filter((item) => item.id !== id) });
  },

  copy(e: any) {
    copyLink(e.currentTarget.dataset.url);
  },

  save() {
    const exercise = this.data.exercise;
    if (!exercise) return;
    updateExercise(exercise.id, {
      description: this.data.description.trim() || undefined,
      links: this.data.links,
      primaryMuscles: splitList(this.data.primaryText),
      secondaryMuscles: splitList(this.data.secondaryText),
      movementPattern: this.data.pattern || undefined,
      equipment: this.data.equipment || undefined,
      steps: this.data.steps.trim() || undefined,
      commonMistakes: this.data.mistakes.trim() || undefined,
    });
    this.setData({ editing: false, error: '' }, () => this.load());
    wx.showToast({ title: '已保存动作资料', icon: 'none' });
  },

  /* ---------- 替代关系 ---------- */

  openSubPicker() {
    this.setData({ pickerOpen: true });
  },

  closePicker() {
    this.setData({ pickerOpen: false });
  },

  onPickTarget(e: any) {
    const { id, name } = e.detail;
    const target = listExercises().find((item) => item.id === id);
    this.setData({
      pickerOpen: false,
      subOpen: true,
      subTo: {
        id,
        name,
        movementPattern: target ? target.movementPattern || '' : '',
      },
      similarity: 'close',
      subDifference: '',
      subEquipment: target && target.equipment ? target.equipment : '',
      subCaution: '',
    });
  },

  closeSub() {
    this.setData({ subOpen: false });
  },

  onSimilarity(e: any) {
    this.setData({ similarity: e.currentTarget.dataset.value });
  },

  onSubDifference(e: any) {
    this.setData({ subDifference: e.detail.value });
  },

  onSubEquipment(e: any) {
    this.setData({ subEquipment: e.detail.value });
  },

  onSubCaution(e: any) {
    this.setData({ subCaution: e.detail.value });
  },

  saveSub() {
    const exercise = this.data.exercise;
    const to = this.data.subTo;
    if (!exercise || !to) return;
    if (!this.data.subDifference.trim()) {
      wx.showToast({ title: '请填写主要区别', icon: 'none' });
      return;
    }
    const target = listExercises().find((item) => item.id === to.id);
    createSubstitution({
      fromExerciseId: exercise.id,
      toExerciseId: to.id,
      similarity: this.data.similarity,
      difference: this.data.subDifference,
      ...(target && target.primaryMuscles ? { primaryMuscles: target.primaryMuscles } : {}),
      ...(to.movementPattern ? { movementPattern: to.movementPattern } : {}),
      ...(this.data.subEquipment.trim() ? { equipment: this.data.subEquipment.trim() } : {}),
      ...(this.data.subCaution.trim() ? { caution: this.data.subCaution.trim() } : {}),
    });
    this.setData({ subOpen: false });
    this.load();
    wx.showToast({ title: '已保存替代关系', icon: 'none' });
  },

  removeSub(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条替代关系？',
      content: '只删除建议，不会影响训练记录。',
      confirmText: '删除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        deleteSubstitution(id);
        this.load();
      },
    });
  },

  openArticle(e: any) {
    wx.navigateTo({ url: `/pages/article/index?id=${e.currentTarget.dataset.id}` });
  },

  openTemplate(e: any) {
    wx.navigateTo({ url: `/pages/template/index?id=${e.currentTarget.dataset.id}` });
  },
});
