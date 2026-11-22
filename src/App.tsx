import { HashRouter, Route, Routes } from 'react-router-dom';
import { GymLogProvider, useGymLog } from './store/gymlog';
import { RestTimerProvider } from './store/restTimer';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { SettingsPage } from './pages/SettingsPage';
import { IconDumbbell } from './components/Icons';

function Splash() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 text-muted">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <IconDumbbell className="h-7 w-7" />
      </span>
      <p className="text-sm">正在读取本地记录…</p>
    </div>
  );
}

function Shell() {
  const { ready } = useGymLog();
  if (!ready) return <Splash />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:date" element={<HistoryDetailPage />} />
        <Route path="exercises" element={<ExercisesPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<TodayPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <GymLogProvider>
      <RestTimerProvider>
        <ToastProvider>
          <HashRouter>
            <Shell />
          </HashRouter>
        </ToastProvider>
      </RestTimerProvider>
    </GymLogProvider>
  );
}
