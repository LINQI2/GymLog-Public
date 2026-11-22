import { listSessions } from '../../utils/store';
import { humanDate, relativeDayLabel } from '../../utils/date';
import { sessionStats, volumeLabel } from '../../utils/format';

Page({
  data: {
    list: [] as any[],
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });
    this.refresh();
  },

  refresh() {
    const sessions = listSessions().filter((session) => session.exercises.length > 0);
    const list = sessions.map((session) => {
      const stats = sessionStats(session);
      const names = session.exercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.name)
        .join(' · ');
      return {
        date: session.date,
        label: humanDate(session.date),
        relative: relativeDayLabel(session.date) || '',
        summary: names,
        exerciseCount: stats.exerciseCount,
        setCount: stats.setCount,
        volumeText: volumeLabel(stats.volume),
      };
    });
    this.setData({ list });
  },

  onOpen(e: any) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    wx.navigateTo({ url: `/pages/day/index?date=${date}` });
  },
});
