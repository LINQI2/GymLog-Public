import {
  applyTemplateToDate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  toggleTemplateFavorite,
  updateTemplate,
} from '../../utils/knowledge';
import { todayISO } from '../../utils/date';
import { uid } from '../../utils/id';
import type { TemplateExercise } from '../../utils/types';

Page({
  data: {
    id: '',
    template: null as any,
    selectedIds: [] as string[],
    initialized: false,
    editing: false,
    pickerOpen: false,
    replaceId: '',
    pickerTitle: '添加动作',
    selectedCount: 0,
  },

  onLoad(options: any) {
    const id = options && options.id ? options.id : '';
    const editing = options && options.edit === '1';
    this.setData({ id, editing }, () => this.refresh());
  },

  onShow() {
    if (this.data.id) this.refresh();
  },

  refresh() {
    const template = getTemplate(this.data.id);
    if (!template) {
      wx.showToast({ title: '模板不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const all = template.exercises.map((item) => item.id);
    // 首次进入默认全选；之后只保留仍然存在的勾选项
    const selectedIds = this.data.initialized
      ? this.data.selectedIds.filter((id) => all.indexOf(id) >= 0)
      : all;
    wx.setNavigationBarTitle({ title: template.name });
    this.setData({
      template,
      initialized: true,
      selectedIds,
      selectedCount: selectedIds.length,
    });
  },

  /* ---------- 勾选 ---------- */

  toggleSelect(e: any) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = this.data.selectedIds.slice();
    const index = selectedIds.indexOf(id);
    if (index >= 0) selectedIds.splice(index, 1);
    else selectedIds.push(id);
    this.setData({ selectedIds, selectedCount: selectedIds.length });
  },

  toggleAll() {
    const template = this.data.template;
    if (!template) return;
    const all = template.exercises.map((item: TemplateExercise) => item.id);
    const selectedIds = this.data.selectedIds.length === all.length ? [] : all;
    this.setData({ selectedIds, selectedCount: selectedIds.length });
  },

  /* ---------- 导入到今日训练 ---------- */

  addToToday() {
    const template = this.data.template;
    if (!template) return;
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: '先勾选要做的动作', icon: 'none' });
      return;
    }
    const date = todayISO();
    const result = applyTemplateToDate(date, template, this.data.selectedIds);
    const parts = [`已添加 ${result.added} 个动作`];
    if (result.skipped) parts.push(`${result.skipped} 个今天已有，已跳过`);
    wx.showModal({
      title: result.added ? '已添加到今日训练' : '今天已经有这些动作',
      content: `${parts.join('，')}。只创建动作卡片，不会生成已完成的组。`,
      confirmText: '去记录',
      cancelText: '留在这里',
      success: (res: any) => {
        if (res.confirm) wx.switchTab({ url: '/pages/today/index' });
      },
    });
  },

  /* ---------- 模板操作 ---------- */

  toggleFavorite() {
    toggleTemplateFavorite(this.data.id);
    this.refresh();
  },

  duplicate() {
    const copy = duplicateTemplate(this.data.id);
    if (!copy) return;
    wx.showToast({ title: '已复制', icon: 'none' });
    wx.redirectTo({ url: `/pages/template/index?id=${copy.id}` });
  },

  remove() {
    const template = this.data.template;
    if (!template) return;
    wx.showModal({
      title: `删除「${template.name}」？`,
      content: '只删除这个方案；已经导入到训练记录里的动作不受影响。',
      confirmText: '删除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        deleteTemplate(this.data.id);
        wx.navigateBack();
      },
    });
  },

  startEdit() {
    this.setData({ editing: true });
  },

  finishEdit() {
    this.setData({ editing: false }, () => this.refresh());
  },

  /* ---------- 基本信息 ---------- */

  onNameBlur(e: any) {
    const name = (e.detail.value || '').trim();
    if (!name) {
      this.refresh();
      return;
    }
    updateTemplate(this.data.id, { name });
    this.refresh();
  },

  onTargetBlur(e: any) {
    updateTemplate(this.data.id, { targetMuscles: (e.detail.value || '').trim() });
    this.refresh();
  },

  onDescBlur(e: any) {
    const value = (e.detail.value || '').trim();
    updateTemplate(this.data.id, { description: value || undefined });
    this.refresh();
  },

  /* ---------- 动作编辑 ---------- */

  saveExercises(exercises: TemplateExercise[]) {
    updateTemplate(this.data.id, { exercises });
    this.refresh();
  },

  onSetsBlur(e: any) {
    const { id } = e.currentTarget.dataset;
    const value = Math.max(1, Math.min(20, parseInt(e.detail.value, 10) || 1));
    const template = this.data.template;
    this.saveExercises(
      template.exercises.map((item: TemplateExercise) =>
        item.id === id ? { ...item, sets: value } : item,
      ),
    );
  },

  onRepMinBlur(e: any) {
    const { id } = e.currentTarget.dataset;
    const value = Math.max(1, Math.min(999, parseInt(e.detail.value, 10) || 1));
    const template = this.data.template;
    this.saveExercises(
      template.exercises.map((item: TemplateExercise) =>
        item.id === id
          ? { ...item, repMin: value, repMax: Math.max(value, item.repMax) }
          : item,
      ),
    );
  },

  onRepMaxBlur(e: any) {
    const { id } = e.currentTarget.dataset;
    const value = Math.max(1, Math.min(999, parseInt(e.detail.value, 10) || 1));
    const template = this.data.template;
    this.saveExercises(
      template.exercises.map((item: TemplateExercise) =>
        item.id === id
          ? { ...item, repMax: Math.max(item.repMin, value) }
          : item,
      ),
    );
  },

  moveItem(e: any) {
    const { id, delta } = e.currentTarget.dataset;
    const template = this.data.template;
    const list = template.exercises.slice();
    const index = list.findIndex((item: TemplateExercise) => item.id === id);
    const target = index + Number(delta);
    if (index < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    this.saveExercises(list);
  },

  removeItem(e: any) {
    const { id } = e.currentTarget.dataset;
    const template = this.data.template;
    wx.showModal({
      title: '从模板中移除这个动作？',
      content: '只影响这个模板，不会改动训练记录。',
      confirmText: '移除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        this.saveExercises(template.exercises.filter((item: TemplateExercise) => item.id !== id));
      },
    });
  },

  replaceItem(e: any) {
    this.setData({
      pickerOpen: true,
      replaceId: e.currentTarget.dataset.id,
      pickerTitle: '选择替代动作',
    });
  },

  addItem() {
    this.setData({ pickerOpen: true, replaceId: '', pickerTitle: '添加动作' });
  },

  onPickExercise(e: any) {
    const { id, name } = e.detail;
    const template = this.data.template;
    const replaceId = this.data.replaceId;
    if (replaceId) {
      this.setData({ pickerOpen: false, replaceId: '' });
      this.saveExercises(
        template.exercises.map((item: TemplateExercise) =>
          item.id === replaceId ? { ...item, exerciseId: id, name } : item,
        ),
      );
      wx.showToast({ title: `已替换为「${name}」`, icon: 'none' });
      return;
    }
    const item: TemplateExercise = {
      id: uid(),
      exerciseId: id,
      name,
      sets: 3,
      repMin: 8,
      repMax: 12,
    };
    this.setData({ pickerOpen: false });
    this.saveExercises([...template.exercises, item]);
  },

  closePicker() {
    this.setData({ pickerOpen: false, replaceId: '' });
  },
});
