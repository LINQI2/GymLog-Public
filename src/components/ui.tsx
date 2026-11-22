import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

/** 底部抽屉 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // 用 ref 保存 onClose，避免父组件每次重渲染（如输入时）都重新执行 effect，
  // 否则会反复改动 body.overflow，在 Android 上可能打断输入法组合输入。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        type="button"
        aria-label="关闭"
        className="animate-fade-in absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* dvh：软键盘弹出时高度自动收缩，避免输入框被键盘遮挡 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-in relative flex max-h-[88dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="flex-1 text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="tap grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
            aria-label="关闭"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer ? (
          <div className="safe-bottom border-t border-line bg-surface px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** 居中确认框 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="取消"
        className="animate-fade-in absolute inset-0 bg-black/45"
        onClick={onCancel}
      />
      <div className="animate-pop-in relative w-full max-w-[360px] rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tap flex-1 rounded-xl border border-line bg-surface-2 py-3 text-sm font-semibold"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`tap flex-1 rounded-xl py-3 text-sm font-semibold text-white ${
              danger ? 'bg-danger' : 'bg-accent'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`tap flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-surface text-accent shadow-sm' : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 开关 */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`tap relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[1.375rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs leading-relaxed text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
