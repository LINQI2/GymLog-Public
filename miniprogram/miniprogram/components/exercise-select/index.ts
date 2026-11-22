import { CATEGORIES } from '../../utils/types';
import { listExercises } from '../../utils/store';

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '选择动作',
    },
  },

  data: {
    keyword: '',
    category: 'all',
    categories: CATEGORIES,
    list: [] as any[],
  },

  observers: {
    show(value: boolean) {
      if (!value) return;
      this.setData({ keyword: '', category: 'all' }, () => this.refresh());
    },
  },

  methods: {
    refresh() {
      const keyword = this.data.keyword.trim().toLowerCase();
      const category = this.data.category;
      const list = listExercises()
        .filter((item) => category === 'all' || item.category === category)
        .filter((item) => !keyword || item.name.toLowerCase().indexOf(keyword) >= 0)
        .map((item) => ({ id: item.id, name: item.name, category: item.category }));
      this.setData({ list });
    },

    onSearch(e: any) {
      this.setData({ keyword: e.detail.value }, () => this.refresh());
    },

    onCategory(e: any) {
      this.setData({ category: e.currentTarget.dataset.category }, () => this.refresh());
    },

    onPick(e: any) {
      const { id, name } = e.currentTarget.dataset;
      this.triggerEvent('pick', { id, name });
    },

    onClose() {
      this.triggerEvent('close');
    },
  },
});
