import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// 打包进 Android 应用时资源已随 APK 本地加载，无需 Service Worker
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true });
} else {
  // 原生端由 MainActivity 处理系统栏内边距（Android 15 强制 edge-to-edge），
  // 这里标记一下，避免 CSS 的 env(safe-area-inset-top) 再叠加一次
  document.documentElement.classList.add('native-app');
}

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 节点');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
