/**
 * 教学链接的校验与打开。
 *
 * 接受三类输入：
 * 1. https / http 网页（抖音、B站、小红书分享出来的都是这种短链）
 * 2. 抖音/B站/小红书的 App 跳转链接（snssdk1128://、douyin://、bilibili://、xhs://），
 *    交给系统用对应 App 打开
 * 3. 带中文和空格的整段分享文案 —— 自动从中提取上面两种链接
 *
 * 仍然拒绝 javascript:、data:、file:、intent: 等伪协议：
 * 在 WebView 里 javascript: 链接等同于执行任意脚本，能读写本地训练数据，
 * intent: 还能构造任意 Android Intent，这不是理论风险，粘贴来源又不受控，
 * 所以只放行上面两类明确可打开的链接。
 */
import type { ExerciseLink } from '../types';
import { uid } from './id';

export const DESCRIPTION_MAX = 2000;
export const LINK_TITLE_MAX = 40;
export const LINK_URL_MAX = 500;
export const LINKS_MAX = 12;

export type LinkPlatform = 'douyin' | 'bilibili' | 'xiaohongshu' | 'youtube' | 'web';

/** 打开方式：web 用系统浏览器，app 用对应客户端 */
export type LinkKind = 'web' | 'app';

/** 明确拒绝的危险协议（intent: 可构造任意 Android Intent） */
const BLOCKED_PROTOCOL = /^(javascript|vbscript|data|file|blob|about|intent|content|chrome):/i;

const PLATFORM_RULES: Array<{ platform: LinkPlatform; domains: string[]; label: string }> = [
  { platform: 'douyin', domains: ['douyin.com', 'iesdouyin.com', 'douyinpic.com'], label: '抖音' },
  { platform: 'bilibili', domains: ['bilibili.com', 'b23.tv', 'bilibili.tv'], label: 'B站' },
  { platform: 'xiaohongshu', domains: ['xiaohongshu.com', 'xhslink.com'], label: '小红书' },
  { platform: 'youtube', domains: ['youtube.com', 'youtu.be'], label: 'YouTube' },
];

/** 允许的 App 跳转协议（抖音「复制打开抖音」得到的 snssdk1128://…） */
const APP_SCHEMES: Record<string, LinkPlatform> = {
  snssdk1128: 'douyin',
  douyin: 'douyin',
  bilibili: 'bilibili',
  xhs: 'xiaohongshu',
};

export type UrlCheckResult =
  | { ok: true; url: string; platform: LinkPlatform; kind: LinkKind }
  | { ok: false; error: string };

function matchDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function schemeOf(value: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

export function detectPlatform(url: string): LinkPlatform {
  const scheme = schemeOf(url);
  if (scheme && APP_SCHEMES[scheme]) return APP_SCHEMES[scheme];

  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'web';
  }
  for (const rule of PLATFORM_RULES) {
    if (rule.domains.some((domain) => matchDomain(hostname, domain))) return rule.platform;
  }
  return 'web';
}

export function platformLabel(platform: LinkPlatform): string {
  return PLATFORM_RULES.find((rule) => rule.platform === platform)?.label ?? '网页';
}

/** 去掉链接尾部粘上的中文标点、右括号等 */
function stripTrailing(value: string): string {
  return value.replace(/[)\]】」》〉"'’，。；、！？,.;:!?]+$/g, '');
}

const TEXT_TAIL = `[^\\s<>"'，。；、！？）】」》〉]+`;

/**
 * 从任意文本里找出第一个可用的链接。
 * 支持整段抖音分享文案，例如：
 * 「7.43 复制打开抖音，看看【xxx】 https://v.douyin.com/abcdef/ 」
 */
export function extractLinkCandidate(raw: string): string | null {
  const text = raw.replace(/[\u3000]/g, ' ').trim();
  if (!text) return null;

  const web = new RegExp(`https?://${TEXT_TAIL}`, 'i').exec(text);
  if (web) return stripTrailing(web[0]);

  const app = new RegExp(`(snssdk1128|douyin|bilibili|xhs)://${TEXT_TAIL}`, 'i').exec(text);
  if (app) return stripTrailing(app[0]);

  // 不带协议的内容，例如「www.bilibili.com/video/BV1xx」
  const bare = new RegExp(`\\b(?:[a-z0-9-]+\\.)+[a-z]{2,}(?::\\d{2,5})?(?:/${TEXT_TAIL})?`, 'i').exec(text);
  if (bare) return stripTrailing(bare[0]);

  return null;
}

function checkAppScheme(candidate: string, scheme: string): UrlCheckResult {
  const rest = candidate.slice(candidate.indexOf('://') + 3);
  if (!rest.trim()) return { ok: false, error: 'App 链接缺少内容' };
  const url = `${scheme}://${rest}`;
  if (url.length > LINK_URL_MAX) return { ok: false, error: `链接最多 ${LINK_URL_MAX} 个字符` };
  return { ok: true, url, platform: APP_SCHEMES[scheme], kind: 'app' };
}

/**
 * 校验并规范化用户输入。
 * - 允许整段分享文案，会自动提取其中的链接
 * - 允许省略 https://（b23.tv/xxx、v.douyin.com/xxx）
 * - 允许抖音/B站/小红书 App 协议
 */
export function checkLinkUrl(raw: string): UrlCheckResult {
  const input = raw.replace(/[\u3000]/g, ' ').trim();
  if (!input) return { ok: false, error: '请输入链接，或直接粘贴分享文案' };
  if (input.length > LINK_URL_MAX) return { ok: false, error: `链接最多 ${LINK_URL_MAX} 个字符` };

  const looksLikePlainUrl = /^(https?|snssdk1128|douyin|bilibili|xhs):/i.test(input);
  if (looksLikePlainUrl && /\s/.test(input)) {
    // 纯链接被空格断开时不要静默截断，否则会存下一个打不开的地址
    return { ok: false, error: '链接中间不要有空格；如果是分享文案，请整段一起粘贴' };
  }

  const candidate = extractLinkCandidate(input);
  if (!candidate) {
    return {
      ok: false,
      error: '没有识别到链接，请粘贴分享文案，或以 https:// 开头的网址',
    };
  }

  const scheme = schemeOf(candidate);
  if (scheme && APP_SCHEMES[scheme]) return checkAppScheme(candidate, scheme);

  if (BLOCKED_PROTOCOL.test(candidate)) {
    return { ok: false, error: '不支持这种链接（出于安全已拦截）' };
  }

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate);
  const target = hasProtocol ? candidate : `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return { ok: false, error: '链接格式不正确' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '只支持网页链接或抖音/B站/小红书的 App 链接' };
  }
  if (!parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) {
    return { ok: false, error: '链接缺少有效的域名' };
  }
  if (parsed.href.length > LINK_URL_MAX) {
    return { ok: false, error: `链接最多 ${LINK_URL_MAX} 个字符` };
  }
  return { ok: true, url: parsed.href, platform: detectPlatform(parsed.href), kind: 'web' };
}

/** 清理从数据库 / 备份里读出来的链接，过滤掉脏数据（老版本没有这些字段） */
export function sanitizeLinks(value: unknown): ExerciseLink[] {
  if (!Array.isArray(value)) return [];
  const result: ExerciseLink[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.url !== 'string') continue;
    const checked = checkLinkUrl(record.url);
    if (!checked.ok) continue;
    if (seen.has(checked.url)) continue;
    seen.add(checked.url);
    const title = typeof record.title === 'string' ? record.title.trim().slice(0, LINK_TITLE_MAX) : '';
    result.push({
      id: typeof record.id === 'string' && record.id ? record.id : uid(),
      title,
      url: checked.url,
    });
    if (result.length >= LINKS_MAX) break;
  }
  return result;
}

export function sanitizeDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\r\n/g, '\n').trim();
  if (!text) return undefined;
  return text.slice(0, DESCRIPTION_MAX);
}

/** 链接在界面上的标题：用户没写标题时回退到平台名 */
export function linkTitle(link: ExerciseLink): string {
  return link.title.trim() || platformLabel(detectPlatform(link.url));
}

/**
 * 用系统外部浏览器 / 对应 App 打开链接。
 *
 * Android 侧：Capacitor 的 WebViewClient 会把所有非本地地址交给
 * `Bridge.launchIntent()`，最终用 Intent.ACTION_VIEW 打开，
 * 因此 https 会进浏览器/系统默认 App，snssdk1128:// 会直接进抖音。
 * 没装对应 App 时系统会静默失败（Caller 需要提示用户）。
 */
export function openExternalUrl(raw: string): boolean {
  const checked = checkLinkUrl(raw);
  if (!checked.ok) return false;

  const anchor = document.createElement('a');
  anchor.href = checked.url;
  if (checked.kind === 'web') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
