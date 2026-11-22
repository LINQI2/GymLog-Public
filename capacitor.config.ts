import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 配置：把已构建的 dist 打包进 Android 应用，完全离线运行。
 * 注意：这里刻意不设置 server.url，避免应用去加载远程网页。
 */
const config: CapacitorConfig = {
  appId: 'com.gymlog.personal',
  appName: '健身记录',
  webDir: 'dist',
  // 使用 https://localhost 作为本地来源，属于安全上下文，IndexedDB 可正常持久化
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // 必须关闭：开启后 Capacitor 会接管输入事件，
    // 中文输入法（搜狗/百度/Gboard）在组合输入阶段会丢字、名称被截断
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  // 不配置任何远程插件
  plugins: {},
};

export default config;
