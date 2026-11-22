import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGymLog } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { EmptyState } from '../components/ui';
import { IconHistory } from '../components/Icons';
import { humanDateFull, relativeDayLabel } from '../lib/date';
import { num, sessionStats, volumeLabel } from '../lib/format';
import { recordedSessions } from '../lib/queries';

export function HistoryPage() {
  const { sessions } = useGymLog();
  const recorded = useMemo(() => recordedSessions(sessions), [sessions]);

  return (
    <>
      <PageHeader title="历史记录" subtitle={`共 ${recorded.length} 天有训练记录`} />

      <div className="px-4 py-3">
        {recorded.length === 0 ? (
          <EmptyState
            icon={<IconHistory className="h-6 w-6" />}
            title="还没有历史记录"
            description="在「今日」页面记录训练后，这里会按日期倒序列出每一天的明细。"
          />
        ) : (
          <div className="space-y-3">
            {recorded.map((session) => {
              const stats = sessionStats(session);
              const relative = relativeDayLabel(session.date);
              return (
                <Link
                  key={session.id}
                  to={`/history/${session.date}`}
                  className="card tap block p-4 active:bg-surface-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">
                      {relative ?? humanDateFull(session.date)}
                    </span>
                    {relative ? (
                      <span className="text-xs text-muted">{humanDateFull(session.date)}</span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted">
                      {stats.exerciseCount} 动作 · {stats.setCount} 组
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1">
                    {session.exercises
                      .filter((entry) => entry.sets.length > 0)
                      .map((entry) => (
                        <li key={entry.id} className="flex items-baseline gap-2 text-[13px]">
                          <span className="shrink-0 font-medium">{entry.name}</span>
                          <span className="truncate text-muted">
                            {entry.sets
                              .map((s) => `${s.weightKg === 0 ? '自重' : num(s.weightKg)}×${s.reps}`)
                              .join('  ')}
                          </span>
                        </li>
                      ))}
                  </ul>

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                    <span>总容量 {volumeLabel(stats.volume)}</span>
                    {session.note ? <span className="truncate">备注：{session.note}</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
