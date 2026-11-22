/**
 * 生成 Android 原生图标资源（纯 Node 实现，无第三方依赖）。
 * 覆盖 android/app/src/main/res/mipmap-* 下的：
 *   ic_launcher.png / ic_launcher_round.png（传统图标）
 *   ic_launcher_foreground.png（自适应图标前景，透明背景）
 * 运行：npm run icons:android
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resDir = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- 绘制 ---------- */
const BG_TOP = [17, 23, 31];
const BG_BOTTOM = [9, 13, 18];
const ACCENT = [52, 211, 153];
const ACCENT_DARK = [16, 185, 129];
const DUMBBELL = [
  [20, 33, 34, 67, 6],
  [34, 41, 43, 59, 4],
  [43, 45.5, 57, 54.5, 4.5],
  [57, 41, 66, 59, 4],
  [66, 33, 80, 67, 6],
];

function mix(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function insideRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** shape: rounded | circle | none（none = 透明背景，仅前景） */
function draw(size, shape, graphicScale) {
  const buf = new Uint8Array(size * size * 4);
  const unit = (size * graphicScale) / 100;
  const ox = (size - unit * 100) / 2;
  const oy = (size - unit * 100) / 2;
  const radius = shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      let visible = true;
      if (shape === 'circle') {
        const dx = px - size / 2;
        const dy = py - size / 2;
        visible = dx * dx + dy * dy <= (size / 2 - 0.5) * (size / 2 - 0.5);
      } else if (shape === 'rounded') {
        visible = insideRoundRect(px, py, 0, 0, size - 1, size - 1, radius);
      }
      if (!visible) continue;

      let color;
      if (shape === 'none') {
        color = [0, 0, 0];
      } else {
        color = mix(BG_TOP, BG_BOTTOM, y / size);
      }

      const ux = (px - ox) / unit;
      const uy = (py - oy) / unit;
      let painted = false;
      if (ux >= 0 && ux <= 100 && uy >= 0 && uy <= 100) {
        for (const [x0, y0, x1, y1, r] of DUMBBELL) {
          if (insideRoundRect(ux, uy, x0, y0, x1, y1, r)) {
            color = mix(ACCENT_DARK, ACCENT, 1 - (uy - y0) / Math.max(1, y1 - y0));
            painted = true;
            break;
          }
        }
      }

      if (shape === 'none' && !painted) {
        buf[i + 3] = 0;
        continue;
      }
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

const DENSITIES = [
  { dir: 'mipmap-mdpi', legacy: 48, adaptive: 108 },
  { dir: 'mipmap-hdpi', legacy: 72, adaptive: 162 },
  { dir: 'mipmap-xhdpi', legacy: 96, adaptive: 216 },
  { dir: 'mipmap-xxhdpi', legacy: 144, adaptive: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, adaptive: 432 },
];

let count = 0;
for (const { dir, legacy, adaptive } of DENSITIES) {
  const out = resolve(resDir, dir);
  mkdirSync(out, { recursive: true });

  writeFileSync(resolve(out, 'ic_launcher.png'), encodePng(legacy, legacy, draw(legacy, 'rounded', 0.94)));
  writeFileSync(
    resolve(out, 'ic_launcher_round.png'),
    encodePng(legacy, legacy, draw(legacy, 'circle', 0.86)),
  );
  writeFileSync(
    resolve(out, 'ic_launcher_foreground.png'),
    encodePng(adaptive, adaptive, draw(adaptive, 'none', 0.58)),
  );
  count += 3;
  console.log(`generated ${dir}: ic_launcher(${legacy}) / round(${legacy}) / foreground(${adaptive})`);
}
console.log(`done: ${count} files`);
