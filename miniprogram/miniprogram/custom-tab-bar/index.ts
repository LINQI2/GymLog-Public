Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/today/index', text: '今日', icon: 'home' },
      { pagePath: '/pages/history/index', text: '历史', icon: 'clock' },
      { pagePath: '/pages/exercises/index', text: '动作', icon: 'dumbbell' },
      { pagePath: '/pages/knowledge/index', text: '知识', icon: 'book' },
      { pagePath: '/pages/settings/index', text: '设置', icon: 'gear' },
    ],
  },

  methods: {
    switchTab(e: any) {
      const index = Number(e.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (!item) return;
      this.setData({ selected: index });
      wx.switchTab({ url: item.pagePath });
    },
  },
});
