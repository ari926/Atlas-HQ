import { useMemo } from 'react';
import { useBoardStore } from '../../stores/boardStore';

const STATUS_COLORS: Record<string, string> = {
  'Done': '#00c875',
  'Working on it': '#fdab3d',
  'Stuck': '#e2445c',
  'In Review': '#579bfc',
  'Not Started': '#c4c4c4',
  'Waiting': '#a25ddc',
};

export default function DashboardBoardView() {
  const { tasks, columns, taskValues, groups } = useBoardStore();
  const statusCol = columns.find(c => c.type === 'status');

  const stats = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const groupCounts: Record<string, { total: number; done: number; name: string; color: string }> = {};

    groups.forEach(g => {
      groupCounts[g.id] = { total: 0, done: 0, name: g.name, color: g.color };
    });

    tasks.forEach(t => {
      const status = statusCol ? (taskValues[t.id]?.[statusCol.id] || 'No Status') : 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (groupCounts[t.group_id]) {
        groupCounts[t.group_id].total++;
        if (status === 'Done') groupCounts[t.group_id].done++;
      }
    });

    return { statusCounts, groupCounts };
  }, [tasks, taskValues, statusCol, groups]);

  const total = tasks.length;
  const done = stats.statusCounts['Done'] || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Completed</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{done}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Completion</div>
          <div className="kpi-value">{pct}%</div>
          <div style={{ marginTop: '0.5rem', height: 6, background: 'var(--color-surface-dynamic)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Stuck</div>
          <div className="kpi-value" style={{ color: 'var(--color-error)' }}>{stats.statusCounts['Stuck'] || 0}</div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card">
        <div className="card-title">Status Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {Object.entries(stats.statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
            const barPct = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = STATUS_COLORS[status] || '#c4c4c4';
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: 100, fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', flexShrink: 0 }}>{status}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--color-surface-dynamic)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 4 }} />
                </div>
                <span style={{ width: 30, textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group progress */}
      <div className="card">
        <div className="card-title">Group Progress</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          {Object.values(stats.groupCounts).map(g => {
            const gPct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
            return (
              <div key={g.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <span style={{ color: 'var(--color-tx-muted)' }}>{g.done}/{g.total} ({gPct}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--color-surface-dynamic)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${gPct}%`, background: g.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
