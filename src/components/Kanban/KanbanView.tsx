import { useMemo } from 'react';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';
import { getInitials, personColor } from '../../lib/utils';

const STATUS_COLUMNS = [
  { label: 'Not Started', color: '#c4c4c4' },
  { label: 'Working on it', color: '#fdab3d' },
  { label: 'In Review', color: '#579bfc' },
  { label: 'Stuck', color: '#e2445c' },
  { label: 'Done', color: '#00c875' },
];

export default function KanbanView() {
  const { tasks, columns, taskValues, updateCellValue } = useBoardStore();
  const openDetail = useUIStore(s => s.openDetail);

  // Find the status column
  const statusCol = columns.find(c => c.type === 'status');
  const personCol = columns.find(c => c.type === 'person');

  const grouped = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    STATUS_COLUMNS.forEach(s => { map[s.label] = []; });
    map[''] = [];
    tasks.forEach(t => {
      const status = statusCol ? (taskValues[t.id]?.[statusCol.id] || '') : '';
      const key = STATUS_COLUMNS.find(s => s.label === status) ? status : (status || '');
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks, taskValues, statusCol]);

  return (
    <div className="kanban-board">
      {STATUS_COLUMNS.map(col => {
        const colTasks = grouped[col.label] || [];
        return (
          <div key={col.label} className="kanban-column">
            <div className="kanban-column-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                {col.label}
              </span>
              <span className="kanban-column-count">{colTasks.length}</span>
            </div>
            <div className="kanban-column-body">
              {colTasks.map(task => {
                const assignee = personCol ? (taskValues[task.id]?.[personCol.id] || '') : '';
                return (
                  <div
                    key={task.id}
                    className="kanban-card"
                    onClick={() => openDetail(task.id)}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                  >
                    <div className="kanban-card-title">{task.title}</div>
                    <div className="kanban-card-meta">
                      {assignee ? (
                        <div className="kanban-card-assignee">
                          <span className="kanban-card-avatar" style={{ background: personColor(assignee) }}>
                            {getInitials(assignee)}
                          </span>
                          <span>{assignee}</span>
                        </div>
                      ) : <span />}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Drop zone */}
            <div
              style={{ minHeight: 40 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId && statusCol) {
                  updateCellValue(taskId, statusCol.id, col.label);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
