import { useMemo } from 'react';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';
import { format, parseISO, differenceInDays, addDays, startOfDay, isValid } from 'date-fns';

export default function TimelineView() {
  const { tasks, columns, taskValues, groups } = useBoardStore();
  const openDetail = useUIStore(s => s.openDetail);

  const dateCol = columns.find(c => c.type === 'date' || c.type === 'timeline');

  const { tasksWithDates, minDate, totalDays } = useMemo(() => {
    if (!dateCol) return { tasksWithDates: [], minDate: new Date(), totalDays: 30 };

    const items: { task: typeof tasks[0]; date: Date; groupColor: string }[] = [];

    tasks.forEach(t => {
      const dateStr = taskValues[t.id]?.[dateCol.id];
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (!isValid(d)) return;
        const group = groups.find(g => g.id === t.group_id);
        items.push({ task: t, date: d, groupColor: group?.color || '#579bfc' });
      } catch { /* skip */ }
    });

    if (items.length === 0) return { tasksWithDates: [], minDate: new Date(), totalDays: 30 };

    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    const min = startOfDay(items[0].date);
    const max = startOfDay(items[items.length - 1].date);
    const days = Math.max(differenceInDays(max, min) + 7, 14);

    return { tasksWithDates: items, minDate: min, totalDays: days };
  }, [tasks, taskValues, dateCol, groups]);

  if (!dateCol) {
    return (
      <div className="empty-state" style={{ padding: '3rem' }}>
        <div className="empty-state-title">No date column found</div>
        <div className="empty-state-text">Add a Date column to enable timeline view.</div>
      </div>
    );
  }

  if (tasksWithDates.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '3rem' }}>
        <div className="empty-state-title">No items with dates</div>
        <div className="empty-state-text">Set dates on your items to see them on the timeline.</div>
      </div>
    );
  }

  // Generate date headers
  const dateHeaders = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
      {/* Date header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-divider)', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2 }}>
        <div style={{ width: 200, flexShrink: 0, padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>Item</div>
        {dateHeaders.map((d, i) => (
          <div key={i} style={{ width: 40, flexShrink: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--color-tx-faint)', padding: '0.375rem 0' }}>
            {format(d, 'd')}
            {(i === 0 || d.getDate() === 1) && <div style={{ fontSize: '0.55rem' }}>{format(d, 'MMM')}</div>}
          </div>
        ))}
      </div>

      {/* Task rows */}
      {tasksWithDates.map(({ task, date, groupColor }) => {
        const offset = differenceInDays(startOfDay(date), minDate);
        return (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-divider)', minHeight: 36 }}>
            <div
              style={{ width: 200, flexShrink: 0, padding: '0.375rem 0.75rem', fontSize: 'var(--text-xs)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={() => openDetail(task.id)}
            >
              {task.title}
            </div>
            <div style={{ position: 'relative', display: 'flex', flex: 1 }}>
              {dateHeaders.map((_, i) => (
                <div key={i} style={{ width: 40, flexShrink: 0, borderLeft: '1px solid var(--color-divider)' }} />
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: offset * 40 + 4,
                  top: 4,
                  height: 28,
                  width: 80,
                  background: groupColor,
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.5rem',
                  fontSize: '0.6rem',
                  color: '#fff',
                  fontWeight: 500,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onClick={() => openDetail(task.id)}
                title={`${task.title} — ${format(date, 'MMM d, yyyy')}`}
              >
                {task.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
