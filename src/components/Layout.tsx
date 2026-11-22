import { NavLink, Outlet } from 'react-router-dom';
import { useGymLog } from '../store/gymlog';
import { useRestTimer } from '../store/restTimer';
import { RestTimerBar } from './RestTimerBar';
import { IconBook, IconDumbbell, IconHistory, IconHome, IconSettings } from './Icons';

const NAV_ITEMS = [
  { to: '/', label: '今日', icon: IconHome, end: true },
  { to: '/history', label: '历史', icon: IconHistory, end: false },
  { to: '/exercises', label: '动作', icon: IconDumbbell, end: false },
  { to: '/knowledge', label: '知识', icon: IconBook, end: false },
  { to: '/settings', label: '设置', icon: IconSettings, end: false },
];

export function Layout() {
  const { storageError } = useGymLog();
  const restTimer = useRestTimer();
  // 计时条出现时额外撑高底部留白，保证最后一个「记录一组」按钮和备注输入框不被遮挡
  const timerActive = restTimer.status !== 'idle';

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col">
      {storageError ? (
        <div className="bg-danger-soft px-4 py-2 text-center text-xs text-danger">
          本地数据库不可用：{storageError}。请关闭无痕模式或允许站点存储。
        </div>
      ) : null}

      <main
        className={`flex-1 ${
          timerActive
            ? 'pb-[calc(9.2rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(5.4rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <Outlet />
      </main>

      <RestTimerBar />

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[560px] items-stretch">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `tap flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-[22px] w-[22px] ${isActive ? '' : 'opacity-80'}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="page-header sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="flex items-center gap-2 px-4 py-3">
        {left}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}
