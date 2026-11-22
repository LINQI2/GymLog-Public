import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGymLog } from '../store/gymlog';
import { PageHeader } from '../components/Layout';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { ConfirmDialog, EmptyState } from '../components/ui';
import { IconChevronLeft, IconHistory, IconTrash } from '../components/Icons';
import { humanDateFull, isISODate } from '../lib/date';

export function HistoryDetailPage() {
  const { date = '' } = useParams();
  const navigate = useNavigate();
  const { getSession, deleteSession } = useGymLog();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = isISODate(date);
  const session = valid ? getSession(date) : undefined;

  return (
    <>
      <PageHeader
        title={valid ? humanDateFull(date) : '日期无效'}
        subtitle="可直接修改，改动会立即保存"
        left={
          <button
            type="button"
            aria-label="返回"
            onClick={() => navigate('/history')}
            className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
        }
        right={
          session ? (
            <button
              type="button"
              aria-label="删除当天记录"
              onClick={() => setConfirmDelete(true)}
              className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-danger"
            >
              <IconTrash className="h-4.5 w-4.5" />
            </button>
          ) : null
        }
      />

      {!valid ? (
        <div className="px-4 py-6">
          <EmptyState icon={<IconHistory className="h-6 w-6" />} title="找不到这个日期" />
        </div>
      ) : (
        <WorkoutEditor date={date} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="删除这一天的全部记录？"
        description={`${valid ? humanDateFull(date) : ''} 的所有动作和组都会被删除，且无法恢复。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteSession(date).then(() => navigate('/history'));
        }}
      />
    </>
  );
}
