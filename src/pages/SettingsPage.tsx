import { useEffect, useMemo, useRef, useState } from 'react';
import { REST_SECONDS_MAX, REST_SECONDS_MIN, useGymLog } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { ConfirmDialog, Segmented, Sheet, Switch } from '../components/ui';
import {
  IconDownload,
  IconFire,
  IconHistory,
  IconUpload,
  IconDumbbell,
  IconTimer,
} from '../components/Icons';
import { useToast } from '../components/Toast';
import { estimateStorage } from '../db';
import { Capacitor } from '@capacitor/core';
import { buildBackup, parseBackup, saveJsonFile, saveTextFile, sessionsToCsv } from '../lib/backup';
import type { ParsedBackup } from '../lib/backup';
import { todayISO } from '../lib/date';
import { sessionStats, volumeLabel } from '../lib/format';
import { recordedSessions } from '../lib/queries';
import type { AppSettings } from '../types';

export function SettingsPage() {
  const {
    sessions,
    exercises,
    templates,
    articles,
    substitutions,
    lastInputs,
    settings,
    setTheme,
    updateSettings,
    importData,
    clearAll,
  } = useGymLog();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [customRestOpen, setCustomRestOpen] = useState(false);
  const [customRestText, setCustomRestText] = useState('');
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    void estimateStorage().then(setStorage);
  }, [sessions, exercises]);

  const summary = useMemo(() => {
    const recorded = recordedSessions(sessions);
    let setCount = 0;
    let volume = 0;
    for (const session of sessions) {
      const stats = sessionStats(session);
      setCount += stats.setCount;
      volume += stats.volume;
    }
    return { days: recorded.length, setCount, volume, exercises: exercises.length };
  }, [sessions, exercises]);

  const handleExportJson = async () => {
    try {
      const data = buildBackup(sessions, exercises, lastInputs, templates, articles, substitutions);
      const result = await saveJsonFile(`gymlog-backup-${todayISO()}.json`, data);
      showToast(result === 'shared' ? '请在弹出的面板中选择保存位置' : '已导出 JSON 备份');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出失败');
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = sessionsToCsv(sessions);
      const result = await saveTextFile(
        `gymlog-sets-${todayISO()}.csv`,
        csv,
        'text/csv;charset=utf-8',
        '保存 CSV 文件',
      );
      showToast(result === 'shared' ? '请在弹出的面板中选择保存位置' : '已导出 CSV（每组一行）');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出失败');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      setPending(parsed);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导入失败');
    }
  };

  return (
    <>
      <PageHeader title="设置" subtitle="全部数据保存在这台设备上" />

      <div className="space-y-4 px-4 py-3">
        {/* 概览 */}
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <IconFire className="h-4 w-4 text-accent" />
            数据概览
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="训练天数" value={`${summary.days} 天`} />
            <StatBox label="总组数" value={`${summary.setCount} 组`} />
            <StatBox label="总容量" value={volumeLabel(summary.volume)} />
            <StatBox label="动作库" value={`${summary.exercises} 个`} />
          </div>
          {storage ? (
            <p className="mt-3 text-[11px] text-muted">
              已占用约 {(storage.usage / 1024).toFixed(0)} KB
              {storage.quota > 0 ? ` / 可用约 ${(storage.quota / 1024 / 1024).toFixed(0)} MB` : ''}
            </p>
          ) : null}
        </section>

        {/* 外观 */}
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">外观</h2>
          <Segmented<AppSettings['theme']>
            value={settings.theme}
            onChange={(value) => void setTheme(value)}
            options={[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]}
          />
        </section>

        {/* 组间休息计时 */}
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <IconTimer className="h-4 w-4 text-accent" />
            组间休息计时
          </h2>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            点击「记录一组」后自动开始倒计时；切换动作、切换页面都会继续计时。
          </p>

          <div className="mb-1.5 text-xs text-muted">默认时长</div>
          <div className="flex flex-wrap gap-2">
            {[60, 90, 120, 180].map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => void updateSettings({ restSeconds: seconds })}
                className={`tap rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  settings.restSeconds === seconds
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted'
                }`}
              >
                {seconds / 60} 分钟
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomRestText(String(settings.restSeconds));
                setCustomRestOpen(true);
              }}
              className="tap rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-xs font-medium text-muted"
            >
              自定义
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            当前默认 {settings.restSeconds} 秒
            {![60, 90, 120, 180].includes(settings.restSeconds) ? '（自定义）' : ''}
          </p>

          <div className="mt-3 divide-y divide-line border-t border-line">
            <SettingRow label="记录一组后自动开始" hint="关闭后只能手动开始计时">
              <Switch
                checked={settings.restAutoStart}
                onChange={(value) => void updateSettings({ restAutoStart: value })}
                label="记录一组后自动开始休息计时"
              />
            </SettingRow>
            <SettingRow label="结束时震动" hint="需要系统的震动权限">
              <Switch
                checked={settings.restVibrate}
                onChange={(value) => void updateSettings({ restVibrate: value })}
                label="休息结束时震动"
              />
            </SettingRow>
            <SettingRow label="结束时提示音" hint="使用网页音效，不下载额外文件">
              <Switch
                checked={settings.restSound}
                onChange={(value) => void updateSettings({ restSound: value })}
                label="休息结束时播放提示音"
              />
            </SettingRow>
          </div>

          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
            安卓在锁屏或切到后台时会暂停网页脚本，所以<strong className="text-ink">不保证</strong>
            休息结束的瞬间就响铃/震动；但计时完全按系统时间计算，回到应用后会立刻校准到正确的剩余时间。
          </p>
        </section>

        {/* 备份 */}
        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold">备份与恢复</h2>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            卸载应用、清理浏览器站点数据或更换手机都可能丢失记录，建议每周导出一次 JSON 备份。
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleExportJson()}
              className="tap flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left"
            >
              <IconDownload className="h-5 w-5 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="block text-sm font-medium">导出 JSON 备份</span>
                <span className="block text-[11px] text-muted">
                  包含训练记录、动作库、学习资料、训练模板、知识文章与替代关系
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportCsv()}
              className="tap flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left"
            >
              <IconDownload className="h-5 w-5 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="block text-sm font-medium">导出 CSV（每组一行）</span>
                <span className="block text-[11px] text-muted">字段：日期、动作、组序号、重量kg、次数</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="tap flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left"
            >
              <IconUpload className="h-5 w-5 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="block text-sm font-medium">从 JSON 导入恢复</span>
                <span className="block text-[11px] text-muted">可选择合并或覆盖现有数据</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              // Android 的文件管理器对 application/json 识别不稳定，原生端不限制类型，靠内容校验
              accept={native ? undefined : 'application/json,.json'}
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
        </section>

        {/* 说明 */}
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <IconHistory className="h-4 w-4 text-accent" />
            关于本地存储
          </h2>
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-muted">
            <li>· 所有数据只保存在这台设备的浏览器数据库（IndexedDB）中，不会上传到任何服务器。</li>
            <li>· 因此也<strong className="text-ink">没有云端同步</strong>：换手机、卸载应用或清理站点数据都会丢失记录。</li>
            <li>· 本应用完全离线可用，无账号、无广告、无网络请求。</li>
            <li>· 在安卓手机上可通过浏览器菜单「添加到主屏幕」安装，像 App 一样使用。</li>
          </ul>
        </section>

        {/* 危险操作 */}
        <section className="card border-danger/40 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-danger">
            <IconDumbbell className="h-4 w-4" />
            危险操作
          </h2>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            清空后所有训练记录与动作库都会被删除，且无法恢复。建议先导出备份。
          </p>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="tap w-full rounded-xl border border-danger/50 py-3 text-sm font-semibold text-danger"
          >
            清空所有数据
          </button>
        </section>

        <p className="pb-2 text-center text-[11px] text-muted">GymLog 健身记录 · 本地版 v1.2.1</p>
      </div>

      {/* 自定义休息时长 */}
      <Sheet
        open={customRestOpen}
        onClose={() => setCustomRestOpen(false)}
        title="自定义休息时长"
        footer={
          <button
            type="button"
            onClick={() => {
              const value = Number(customRestText);
              if (!Number.isFinite(value) || value <= 0) {
                showToast('请输入有效的秒数');
                return;
              }
              const seconds = Math.min(REST_SECONDS_MAX, Math.max(REST_SECONDS_MIN, Math.round(value)));
              void updateSettings({ restSeconds: seconds });
              setCustomRestOpen(false);
              showToast(`默认休息 ${seconds} 秒`);
            }}
            className="tap w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink"
          >
            保存
          </button>
        }
      >
        <label className="text-xs font-semibold text-muted" htmlFor="settings-rest-custom">
          秒数（{REST_SECONDS_MIN}–{REST_SECONDS_MAX}）
        </label>
        <input
          id="settings-rest-custom"
          value={customRestText}
          onChange={(event) => setCustomRestText(event.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          type="text"
          pattern="[0-9]*"
          autoFocus
          autoComplete="off"
          className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-[16px] outline-none focus:border-accent"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          训练页的计时条上也可以随时点数字改时长。
        </p>
      </Sheet>

      {/* 导入确认 */}
      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title="确认导入"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!pending) return;
                await importData(pending, 'merge');
                setPending(null);
                showToast('已合并导入');
              }}
              className="tap flex-1 rounded-xl border border-line py-3 text-sm font-semibold"
            >
              合并到现有数据
            </button>
            <button
              type="button"
              onClick={() => setConfirmReplace(true)}
              className="tap flex-1 rounded-xl bg-danger py-3 text-sm font-semibold text-white"
            >
              覆盖现有数据
            </button>
          </div>
        }
      >
        {pending ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted">
              备份导出时间：{pending.meta.exportedAt.slice(0, 19).replace('T', ' ')}
            </p>
            <p>
              包含 <strong>{pending.sessions.length}</strong> 天训练记录、
              <strong>{pending.exercises.length}</strong> 个动作库条目、
              <strong>{pending.templates.length}</strong> 个训练模板、
              <strong>{pending.articles.length}</strong> 篇知识文章
              {pending.meta.version < 3 ? '（旧版备份，不含知识库）' : ''}。
            </p>
            <p className="rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-muted">
              「合并」会保留现有记录，把同一天的数据合并；「覆盖」会先清空本机所有数据，再写入备份内容。
            </p>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirmReplace}
        title="确定覆盖本机数据？"
        description="本机现有的全部训练记录与动作库将被清空，然后写入备份文件的内容。此操作不可撤销。"
        confirmText="确认覆盖"
        danger
        onCancel={() => setConfirmReplace(false)}
        onConfirm={async () => {
          if (!pending) return;
          setConfirmReplace(false);
          await importData(pending, 'replace');
          setPending(null);
          showToast('已覆盖导入');
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="清空所有数据？"
        description="所有训练记录、动作库都会从这台设备上删除，无法恢复。"
        confirmText="全部删除"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          await clearAll();
          showToast('已清空全部数据');
        }}
      />
    </>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
