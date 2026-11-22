/**
 * 链接解析与复制。
 *
 * 小程序不能直接打开外部浏览器或唤起抖音，所以统一的交互是「复制链接」，
 * 由用户到对应 App / 浏览器里打开。这里只负责把分享文案解析成可用链接。
 */
import type { ExerciseLink } from './types';
import { uid } from './id';

export const LINK_TITLE_MAX = 40;
export const LINK_URL_MAX = 2000;
export const LINKS_MAX = 8;

const SAFE_SCHEMES = ['https:', 'http:', 'snssdk1128:', 'douyin:', 'bilibili:', 'xhs:'];
const BLOCKED_SCHEME = /^(javascript|data|file|intent|weixin|alipay|tel|mailto):/i;
const URL_IN_TEXT = /(?:https?:\/\/|snssdk1128:\/\/|douyin:\/\/|bilibili:\/\/|xhs:\/\/)[^\s"'<>，。；、）】【]+/i;
const BARE_DOMAIN = /(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s"'<>，。；、）】【]*)?/i;
const TRAILING = /[),.;!?'"”’]+$/;

export interface LinkResult {
  ok: boolean;
  url: string;
  error?: string;
}

function checkUrl(raw: string): LinkResult {
  const url = raw.replace(TRAILING, '');
  const lower = url.toLowerCase();
  if (BLOCKED_SCHEME.test(lower)) {
    return { ok: false, url: '', error: '不支持该协议，只允许网页链接或抖音/B站/小红书 App 链接' };
  }
  const colon = lower.indexOf(':');
  if (colon < 0) return { ok: false, url: '', error: '链接格式不正确' };
  const scheme = lower.slice(0, colon + 1);
  if (SAFE_SCHEMES.indexOf(scheme) < 0) {
    return { ok: false, url: '', error: '只支持网页链接或 App 链接' };
  }
  if (url.length > LINK_URL_MAX) return { ok: false, url: '', error: '链接太长' };
  return { ok: true, url };
}

/** 从「整段分享文案」里提取链接；不带协议时自动补 https:// */
export function normalizeLink(raw: string): LinkResult {
  const text = `${raw || ''}`.trim();
  if (!text) return { ok: false, url: '', error: '请粘贴链接或分享文案' };

  const withScheme = text.match(URL_IN_TEXT);
  if (withScheme) return checkUrl(withScheme[0]);

  const bare = text.match(BARE_DOMAIN);
  if (bare) return checkUrl(`https://${bare[0]}`);

  if (BLOCKED_SCHEME.test(text)) {
    return { ok: false, url: '', error: '不支持该协议（例如 javascript:）' };
  }
  return { ok: false, url: '', error: '没有识别到链接，请重新复制分享文案' };
}

/** 清理备份/录入的链接列表：丢弃危险协议、补齐 id */
export function safeLinks(value: unknown): ExerciseLink[] {
  if (!Array.isArray(value)) return [];
  const result: ExerciseLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!url) continue;
    const checked = normalizeLink(url);
    if (!checked.ok) continue;
    result.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      title: typeof raw.title === 'string' ? raw.title.trim().slice(0, LINK_TITLE_MAX) : '',
      url: checked.url,
    });
    if (result.length >= LINKS_MAX) break;
  }
  return result;
}

export function platformLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.indexOf('douyin') >= 0 || lower.indexOf('snssdk1128') >= 0) return '抖音';
  if (lower.indexOf('bilibili') >= 0 || lower.indexOf('b23.tv') >= 0) return 'B站';
  if (lower.indexOf('xiaohongshu') >= 0 || lower.indexOf('xhs') >= 0) return '小红书';
  if (lower.indexOf('youtube') >= 0 || lower.indexOf('youtu.be') >= 0) return 'YouTube';
  return '网页';
}

export function linkTitle(link: ExerciseLink): string {
  return link.title || platformLabel(link.url);
}

/** 小程序里复制链接，再让用户去对应 App 打开 */
export function copyLink(url: string): void {
  wx.setClipboardData({
    data: url,
    success: () => {
      wx.showModal({
        title: '链接已复制',
        content: '小程序内不能直接打开外部 App 或浏览器。已复制链接，可以到抖音 / B站 / 浏览器里粘贴打开。',
        showCancel: false,
        confirmText: '知道了',
      });
    },
    fail: () => {
      wx.showToast({ title: '复制失败，请手动选择链接', icon: 'none' });
    },
  });
}
