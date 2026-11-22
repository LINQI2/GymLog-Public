import { ensureSeed } from './utils/store';
import { ensureKnowledgeSeed } from './utils/seed-knowledge';
import { initRestTimer } from './utils/rest-timer';

App({
  onLaunch() {
    // 首次启动写入内置动作库、示例模板与知识文章；并恢复上次未结束的休息计时
    ensureSeed();
    ensureKnowledgeSeed();
    initRestTimer();
  },

  onShow() {
    // 从后台回来时，计时条会按时间戳自行校准，这里不需要额外处理
  },

  globalData: {},
});
