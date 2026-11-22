/**
 * 在无法执行 `cap sync`（例如被文件保护拦截）时，手动更新
 * android/app/src/main/assets/capacitor.config.json，使其与 capacitor.config.ts 的关键项一致。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');

if (!existsSync(target)) {
  console.log('capacitor.config.json 不存在，跳过（首次请先执行 npx cap add android）');
  process.exit(0);
}

const config = JSON.parse(readFileSync(target, 'utf8'));
config.appId = 'com.gymlog.personal';
config.appName = '健身记录';
config.webDir = 'dist';
config.server = { ...(config.server ?? {}), androidScheme: 'https' };
config.android = {
  ...(config.android ?? {}),
  allowMixedContent: false,
  // 必须为 false，否则中文输入法在 WebView 中会丢字
  captureInput: false,
  webContentsDebuggingEnabled: false,
};

writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log('已更新 capacitor.config.json（captureInput=false，无远程 server.url）');
