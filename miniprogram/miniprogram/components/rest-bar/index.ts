import {
  applyDuration,
  formatRest,
  getState,
  pause,
  remainingMs,
  restart,
  resume,
  skip,
  subscribe,
  tick,
} from '../../utils/rest-timer';

Component({
  properties: {
    /** tabBar 页面需要把计时条抬到自定义 tabBar 之上 */
    aboveTabBar: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    visible: false,
    timeText: '00:00',
    statusText: '',
    running: false,
    done: false,
  },

  lifetimes: {
    attached() {
      this.unsubscribe = subscribe((state: any) => this.render(state));
      this.render(getState());
      this.startTimer();
    },
    detached() {
      this.stopTimer();
      if (this.hideTimer) clearTimeout(this.hideTimer);
      if (this.unsubscribe) this.unsubscribe();
    },
  },

  pageLifetimes: {
    show() {
      // 从后台/其他页面回来：立即按真实时间校准
      tick();
      this.render(getState());
      this.startTimer();
    },
    hide() {
      this.stopTimer();
    },
  },

  methods: {
    startTimer() {
      if (this.timer) return;
      this.timer = setInterval(() => {
        tick();
        const state = getState();
        if (state.status === 'running') this.render(state);
      }, 500);
    },

    stopTimer() {
      if (!this.timer) return;
      clearInterval(this.timer);
      this.timer = null;
    },

    render(state: any) {
      const done = state.status === 'done';
      const ms = remainingMs();
      this.setData({
        visible: state.status !== 'idle',
        timeText: done ? '00:00' : formatRest(ms),
        statusText: done
          ? '休息结束，可以开始下一组'
          : state.status === 'paused'
            ? '已暂停'
            : '休息中 · 点数字改时长',
        running: state.status === 'running',
        done,
      });

      if (done && !this.hideTimer) {
        this.hideTimer = setTimeout(() => {
          this.hideTimer = null;
          skip();
        }, 30000);
      }
      if (!done && this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    },

    onToggle() {
      const state = getState();
      if (state.status === 'running') pause();
      else if (state.status === 'done') restart();
      else if (state.status === 'paused') resume();
    },

    onRestart() {
      restart();
    },

    onSkip() {
      skip();
    },

    onDuration() {
      const presets = [60, 90, 120, 180];
      wx.showActionSheet({
        itemList: ['60 秒', '90 秒', '120 秒', '180 秒', '自定义…'],
        success: (res: any) => {
          if (res.tapIndex === 4) {
            wx.showModal({
              title: '自定义休息时长',
              editable: true,
              placeholderText: '秒数，5-1800',
              success: (modal: any) => {
                if (!modal.confirm) return;
                const seconds = parseInt(modal.content, 10);
                if (!isFinite(seconds) || seconds < 5) {
                  wx.showToast({ title: '请输入 5 秒以上', icon: 'none' });
                  return;
                }
                applyDuration(seconds);
                wx.showToast({ title: `休息 ${Math.min(1800, seconds)} 秒`, icon: 'none' });
              },
            });
            return;
          }
          const seconds = presets[res.tapIndex];
          applyDuration(seconds);
          wx.showToast({ title: `休息 ${seconds} 秒`, icon: 'none' });
        },
      });
    },
  },
});
