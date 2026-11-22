import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { WorkoutSession } from '../types';

export { buildBackup, parseBackup, type ParsedBackup } from './backupFormat';

/* ---------- 导出文件 ---------- */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
}

export type SaveResult = 'shared' | 'downloaded';

/**
 * 保存文本文件。
 * - 浏览器：直接触发下载
 * - Android 应用（Capacitor WebView）：WebView 不支持 a[download]，
 *   改为写入应用缓存目录后调起系统「分享 / 保存到文件」面板。
 */
export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: filename,
      files: [result.uri],
      dialogTitle,
    });
    return 'shared';
  }
  downloadBlob(filename, new Blob([content], { type: mimeType }));
  return 'downloaded';
}

export async function saveJsonFile(
  filename: string,
  data: unknown,
): Promise<SaveResult> {
  return saveTextFile(
    filename,
    JSON.stringify(data, null, 2),
    'application/json;charset=utf-8',
    '保存 JSON 备份',
  );
}

/** 每一组一行：日期,动作,组序号,重量kg,次数 */
export function sessionsToCsv(sessions: WorkoutSession[]): string {
  const rows: string[] = ['日期,动作,组序号,重量kg,次数'];
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of sorted) {
    const entries = [...session.exercises].sort((a, b) => a.order - b.order);
    for (const entry of entries) {
      entry.sets.forEach((set, index) => {
        rows.push(
          [session.date, csvCell(entry.name), index + 1, set.weightKg, set.reps].join(','),
        );
      });
    }
  }
  // 加 BOM，Excel 打开中文不乱码
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
