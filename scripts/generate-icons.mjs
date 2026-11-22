/**
 * 生成 PWA 图标（纯 Node 实现，无第三方依赖）。
 * 输出：public/icons/icon-192.png、icon-512.png、icon-maskable-512.png、apple-touch-icon.png
 * 运行：npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');

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
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- 绘制 ---------- */
const BG_TOP = [16, 22, 30];
const BG_BOTTOM = [9, 13, 18];
const ACCENT = [52, 211, 153];
const ACCENT_DARK = [16, 185, 129];

function insideRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function mix(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function sample(buffer, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const i = (y * w + x) * 4;
  if (buffer[i + 3] < 128) return null;
  return [buffer[i], buffer[i + 1], buffer[i + 2]];
}

/** 哑铃形状：以 100x100 的虚拟坐标系绘制 */
const DUMBBELL = [
  // [x0, y0, x1, y1, radius]
  [20, 33, 34, 67, 6], // 左外块
  [34, 41, 43, 59, 4], // 左内块
  [43, 45.5, 57, 54.5, 4.5], // 握杆
  [57, 41, 66, 59, 4], // 右内块
  [66, 33, 80, 67, 6], // 右外块
];

function drawIcon(size, { maskable = false } = {}) {
  const buf = new Uint8Array(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  // maskable 图标：图形占安全区的比例更小
  const scale = maskable ? 0.62 : 0.94;
  const unit = (size * scale) / 100;
  const ox = (size - unit * 100) / 2;
  const oy = (size - unit * 100) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundRect(x, y, 0, 0, size - 1, size - 1, radius)) continue;

      // 背景渐变 + 轻微径向高光
      const t = y / size;
      let color = mix(BG_TOP, BG_BOTTOM, t);
      const dx = (x - size * 0.5) / size;
      const dy = (y - size * 0.34) / size;
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.6);
      color = mix(color, ACCENT, glow * 0.14);

      // 哑铃
      const ux = (x + 0.5 - ox) / unit;
      const uy = (y + 0.5 - oy) / unit;
      if (ux >= 0 && ux <= 100 && uy >= 0 && uy <= 100) {
        for (const [x0, y0, x1, y1, r] of DUMBBELL) {
          if (insideRoundRect(ux, uy, x0, y0, x1, y1, r)) {
            color = mix(ACCENT_DARK, ACCENT, 1 - (uy - y0) / Math.max(1, y1 - y0));
            break;
          }
        }
      }

      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }

  // 抗锯齿：对边缘像素按邻居覆盖率降低不透明度
  const out = Uint8Array.from(buf);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (buf[i + 3] === 0) continue;
      let opaque = 0;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          total++;
          if (sample(buf, size, size, x + dx, y + dy)) opaque++;
        }
      }
      if (opaque < total) out[i + 3] = Math.round((opaque / total) * 255);
    }
  }
  return out;
}

mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  { file: 'icon-maskable-512.png', size: 512, opts: { maskable: true } },
  { file: 'apple-touch-icon.png', size: 180, opts: { maskable: true } },
];

for (const { file, size, opts } of targets) {
  const png = encodePng(size, size, drawIcon(size, opts));
  writeFileSync(resolve(outDir, file), png);
  console.log(`generated ${file} (${size}x${size}, ${png.length} bytes)`);
}
