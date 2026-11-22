import { fullDateLabel, isISODate, todayISO } from '../../utils/date';

Page({
  data: {
    date: '',
  },

  onLoad(options: any) {
    const raw = options && options.date ? options.date : '';
    const date = isISODate(raw) ? raw : todayISO();
    this.setData({ date });
    wx.setNavigationBarTitle({ title: fullDateLabel(date) });
  },
});
