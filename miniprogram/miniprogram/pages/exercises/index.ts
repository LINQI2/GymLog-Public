import { CATEGORIES, type ExerciseCatalogItem, type ExerciseCategory } from '../../utils/types';
import {
  createExercise,
  deleteExercise,
  listExercises,
  listSessions,
  updateExercise,
} from '../../utils/store';

Page({
  data: {
    keyword: '',
    category: 'all',
    categories: CATEGORIES,
    list: [] as Array<ExerciseCatalogItem & { subText: string }>,
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 2 });
    this.refresh();
  },

  refresh() {
    const usage = new Map<string, number>();
    listSessions().forEach((session) => {
      session.exercises.forEach((entry) => {
        if (!entry.exerciseId) return;
        usage.set(entry.exerciseId, (usage.get(entry.exerciseId) || 0) + entry.sets.length);
      });
    });

    const keyword = this.data.keyword.trim().toLowerCase();
    const list = listExercises()
      .filter((item) => this.data.category === 'all' || item.category === this.data.category)
      .filter((item) => !keyword || item.name.toLowerCase().indexOf(keyword) >= 0)
      .map((item) => {
        const sets = usage.get(item.id) || 0;
        const parts: string[] = [item.category];
        if (sets > 0) parts.push(`已记录 ${sets} 组`);
        if (item.recentlyUsedAt) parts.push('最近使用');
        return { ...item, subText: parts.join(' · ') };
      });

    this.setData({ list });
  },

  onSearch(e: any) {
    this.setData({ keyword: e.detail.value }, () => this.refresh());
  },

  onCategory(e: any) {
    this.setData({ category: e.currentTarget.dataset.category }, () => this.refresh());
  },

  onCreate() {
    wx.showModal({
      title: '新建动作',
      editable: true,
      placeholderText: '动作名称，例如：反手哑铃侧平举',
      success: (res: any) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim();
        if (!name) {
          wx.showToast({ title: '请输入动作名称', icon: 'none' });
          return;
        }
        if (name.length > 24) {
          wx.showToast({ title: '名称最多 24 个字', icon: 'none' });
          return;
        }
        wx.showActionSheet({
          itemList: CATEGORIES,
          success: (picker: any) => {
            try {
              const category = CATEGORIES[picker.tapIndex] as ExerciseCategory;
              const item = createExercise(name, category);
              this.refresh();
              wx.showToast({ title: `已创建「${item.name}」`, icon: 'none' });
            } catch (error) {
              wx.showToast({ title: (error as Error).message || '创建失败', icon: 'none' });
            }
          },
        });
      },
    });
  },

  openInfo(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/exercise-info/index?id=${id}` });
  },

  onMenu(e: any) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((candidate) => candidate.id === id);
    if (!item) return;

    wx.showActionSheet({
      itemList: [item.isFavorite ? '取消收藏' : '收藏', '重命名', '修改分类', '删除动作'],
      success: (res: any) => {
        if (res.tapIndex === 0) {
          updateExercise(id, { isFavorite: !item.isFavorite });
          this.refresh();
        }
        if (res.tapIndex === 1) this.rename(item);
        if (res.tapIndex === 2) this.changeCategory(item);
        if (res.tapIndex === 3) this.confirmDelete(item);
      },
    });
  },

  rename(item: ExerciseCatalogItem) {
    wx.showModal({
      title: '重命名动作',
      editable: true,
      content: item.name,
      placeholderText: '新的动作名称',
      success: (res: any) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim();
        if (!name) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        updateExercise(item.id, { name });
        this.refresh();
        wx.showToast({ title: '已重命名', icon: 'none' });
      },
    });
  },

  changeCategory(item: ExerciseCatalogItem) {
    wx.showActionSheet({
      itemList: CATEGORIES,
      success: (res: any) => {
        const category = CATEGORIES[res.tapIndex] as ExerciseCategory;
        updateExercise(item.id, { category });
        this.refresh();
      },
    });
  },

  confirmDelete(item: ExerciseCatalogItem) {
    wx.showModal({
      title: `删除「${item.name}」？`,
      content: '只会从动作库移除，已有的历史训练记录不受影响。',
      confirmText: '删除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        deleteExercise(item.id);
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      },
    });
  },
});
