interface IconProps {
  className?: string;
  filled?: boolean;
}

function base(className?: string): string {
  return className ?? 'h-5 w-5';
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconDumbbell({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" />
    </svg>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  );
}

export function IconHistory({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5" />
      <path d="M12 8v4.6l3.2 1.9" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMinus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2.2}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7M10.5 11v5M13.5 11v5" />
    </svg>
  );
}

export function IconPencil({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M16.4 4.6l3 3L8.8 18.2l-4 1 1-4z" />
      <path d="M14.6 6.4l3 3" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2.3}>
      <path d="M5 12.8 9.6 17.4 19 8" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2.1}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function IconStar({ className, filled }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={base(className)}
      {...strokeProps}
      fill={filled ? 'currentColor' : 'none'}
    >
      <path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.9l5.4-.8z" />
    </svg>
  );
}

export function IconUndo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M9 7H5V3" />
      <path d="M5 7.5A8 8 0 1 1 12 20a8 8 0 0 1-6.8-3.8" />
    </svg>
  );
}

export function IconMore({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} fill="currentColor">
      <circle cx="12" cy="5.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="18.5" r="1.7" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M20 13.5A8.2 8.2 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M12 4v10M8 10.5l4 4 4-4M4.5 19.5h15" />
    </svg>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M12 15.5V5M8 8.5l4-4 4 4M4.5 19.5h15" />
    </svg>
  );
}

export function IconNote({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M6 3.5h9L19 7.5v13H6z" />
      <path d="M14.5 3.5V8h4.5M9 12h7M9 15.5h5" />
    </svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M4.5 19.5v-6M10 19.5V7M15.5 19.5v-8M21 19.5v-13" />
    </svg>
  );
}

export function IconFire({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M12 3.5c3.2 3 5 5.6 5 8.4a5 5 0 0 1-10 0c0-1.4.5-2.6 1.4-3.8.5 1 1.1 1.6 1.9 1.9-.3-2.3.3-4.4 1.7-6.5z" />
    </svg>
  );
}

export function IconTimer({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4.2l2.8 1.7M9.5 3h5M12 3v2.5" />
    </svg>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2.4}>
      <path d="M9 5.5v13M15 5.5v13" />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps} strokeWidth={2}>
      <path d="M8 5.5 18.5 12 8 18.5z" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.5V10h-5.5" />
    </svg>
  );
}

export function IconSkip({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M6 5.5 15 12l-9 6.5zM18.5 5.5v13" />
    </svg>
  );
}

export function IconBook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M4.5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v13a2 2 0 0 0-2-2h-6.5z" />
      <path d="M19.5 4.5h-4A2.5 2.5 0 0 0 13 7v13a2 2 0 0 1 2-2h4.5z" />
    </svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5L11.6 7.3" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5l1.4-1.4" />
    </svg>
  );
}

export function IconSort({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M4 7h9M4 12h6M4 17h3" />
      <path d="M18 5.5v13M15 15.5 18 18.5l3-3" />
    </svg>
  );
}

export function IconArrowUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
    </svg>
  );
}

export function IconArrowDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function IconInfo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 8.1v.1" />
    </svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15h1" />
    </svg>
  );
}

export function IconExternal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base(className)} {...strokeProps}>
      <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </svg>
  );
}
