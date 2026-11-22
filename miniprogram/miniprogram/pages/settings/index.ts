import { ensureSeed, getSettings, listSessions, saveSettings } from '../../utils/store';
import { sessionStats } from '../../utils/format';
import { clearBusinessData, storageInfo } from '../../utils/storage';
import { applyDuration } from '../../utils/rest-timer';
import {
  importBackup,
  parseBackup,
  readFileText,
  shareFile,
  writeBackupFile,
} from '../../utils/backup';
import { listArticles, listSubstitutions, listTemplates } from '../../utils/knowledge';

Page({
  data: {
    settings: getSettings(),
    presets: [60, 90, 120, 180],
    days: 0,
    sets: 0,
    usageText: '',
    version: '小程序 0.2.1 · 数据格式 v3',
    templates: 0,
    articles: 0,
    substitutions: 0,
    importOpen: false,
    pending: null as any,
    pendingInfo: '',
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 4 });
    this.refresh();
  },

  refresh() {
    const sessions = listSessions();
    let sets = 0;
    sessions.forEach((session) => {
      sets += sessionStats(session).setCount;
    });
    const info = storageInfo();
    this.setData({
      settings: getSettings(),
      days: sessions.filter((session) => session.exercises.length > 0).length,
      sets,
      usageText: `${info.currentSize} KB / ${info.limitSize} KB`,
      templates: listTemplates().length,
      articles: listArticles().length,
      substitutions: listSubstitutions().length,
    });
  },

  onRest(e: any) {
    const seconds = Number(e.currentTarget.dataset.seconds);
    saveSettings({ restSeconds: seconds });
    this.refresh();
  },

  onCustomRest() {
    wx.showModal({
      title: '自定义休息时长',
      editable: true,
      content: String(this.data.settings.restSeconds),
      placeholderText: '秒数，5-1800',
      success: (res: any) => {
        if (!res.confirm) return;
        const seconds = parseInt(res.content, 10);
        if (!isFinite(seconds) || seconds < 5 || seconds > 1800) {
          wx.showToast({ title: '请输入 5-1800 秒', icon: 'none' });
          return;
        }
        applyDuration(seconds);
        this.refresh();
        wx.showToast({ title: `已设为 ${seconds} 秒`, icon: 'none' });
      },
    });
  },

  onAutoStart(e: any) {
    saveSettings({ restAutoStart: e.detail.value });
    this.refresh();
  },

  onVibrate(e: any) {
    saveSettings({ restVibrate: e.detail.value });
    this.refresh();
  },

  /* ---------- 备份 ---------- */

  onExport() {
    const file = writeBackupFile();
    if (!file.ok) {
      wx.showModal({
        title: '导出失败',
        content: file.error || '写入文件失败，可能是本地空间不足',
        showCancel: false,
      });
      return;
    }
    wx.showModal({
      title: '备份已生成',
      content: `文件名：${file.fileName}\n\n小程序不能直接保存到手机文件夹。点「发送」可以把文件转发到聊天（例如文件传输助手），之后用来导入或换机。`,
      confirmText: '发送',
      cancelText: '稍后再说',
      success: (res: any) => {
        if (!res.confirm) return;
        shareFile(file.filePath as string, file.fileName as string).then((ok) => {
          if (ok) return;
          wx.showModal({
            title: '当前环境不支持发送文件',
            content: '开发者工具或旧版本微信可能不支持分享文件。请用真机预览，或把文件路径里的内容手动复制出来。',
            showCancel: false,
          });
        });
      },
    });
  },

  onImport() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res: any) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        const text = readFileText(file.path);
        if (!text) {
          wx.showToast({ title: '读取文件失败', icon: 'none' });
          return;
        }
        const parsed = parseBackup(text);
        if (parsed.ok === false) {
          const message = parsed.error;
          wx.showModal({ title: '无法导入', content: message, showCancel: false });
          return;
        }
        this.setData({
          importOpen: true,
          pending: parsed.data,
          pendingInfo: `训练 ${parsed.data.sessions.length} 天 · 动作 ${parsed.data.exercises.length} 个 · 模板 ${parsed.data.templates.length} 个 · 文章 ${parsed.data.articles.length} 篇 · 替代 ${parsed.data.substitutions.length} 条（备份版本 v${parsed.data.meta.version}）`,
        });
      },
      fail: () => {
        wx.showToast({ title: '没有选择文件', icon: 'none' });
      },
    });
  },

  closeImport() {
    this.setData({ importOpen: false, pending: null });
  },

  doMerge() {
    const data = this.data.pending;
    if (!data) return;
    const result = importBackup(data, 'merge');
    this.setData({ importOpen: false, pending: null });
    this.refresh();
    wx.showModal({
      title: '合并完成',
      content: `新增 ${result.sessions} 天记录、${result.exercises} 个动作、${result.templates} 个模板、${result.articles} 篇文章、${result.substitutions} 条替代关系。已有内容不会被覆盖。`,
      showCancel: false,
    });
  },

  doReplace() {
    wx.showModal({
      title: '覆盖导入？',
      content: '会先清空这台手机上现有的训练记录与知识内容，再写入备份。设置与休息计时不受影响。',
      confirmText: '覆盖',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        const data = this.data.pending;
        if (!data) return;
        const result = importBackup(data, 'replace');
        this.setData({ importOpen: false, pending: null });
        this.refresh();
        wx.showModal({
          title: '已覆盖导入',
          content: `${result.sessions} 天记录、${result.exercises} 个动作、${result.templates} 个模板、${result.articles} 篇文章。`,
          showCancel: false,
        });
      },
    });
  },

  onClear() {
    wx.showModal({
      title: '清空所有数据？',
      content: '训练记录、动作库都会从这台手机删除，无法恢复。',
      confirmText: '全部删除',
      confirmColor: '#d64545',
      success: (res: any) => {
        if (!res.confirm) return;
        clearBusinessData();
        ensureSeed();
        this.refresh();
        wx.showToast({ title: '已清空', icon: 'none' });
      },
    });
  },
});
