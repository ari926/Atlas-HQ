import { useMemo, useState } from 'react';
import BoardHeader from './BoardHeader';
import GroupHeader from './GroupHeader';
import BoardRow from './BoardRow';
import AddItemRow from './AddItemRow';
import SummaryRow from './SummaryRow';
import Modal from '../common/Modal';
import { useBoardStore } from '../../stores/boardStore';

const COLUMN_TYPES = [
  { type: 'status' as const, label: 'Status' },
  { type: 'person' as const, label: 'Person' },
  { type: 'date' as const, label: 'Date' },
  { type: 'text' as const, label: 'Text' },
  { type: 'number' as const, label: 'Number' },
  { type: 'checkbox' as const, label: 'Checkbox' },
  { type: 'priority' as const, label: 'Priority' },
];

export default function BoardTable() {
  const {
    groups, columns, tasks, taskValues, selectedTasks,
    searchQuery, sortCol, sortDir, collapsedGroups,
  } = useBoardStore();

  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<typeof COLUMN_TYPES[number]['type']>('text');
  const addColumn = useBoardStore(s => s.addColumn);

  // Filter by search
  const visibleTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t => {
      if (t.title.toLowerCase().includes(q)) return true;
      const vals = taskValues[t.id] || {};
      return Object.values(vals).some(v => v.toLowerCase().includes(q));
    });
  }, [tasks, taskValues, searchQuery]);

  // Sort
  const sortedTasks = useMemo(() => {
    if (!sortCol) return visibleTasks;
    return [...visibleTasks].sort((a, b) => {
      let va = '', vb = '';
      if (sortCol === 'title') { va = a.title; vb = b.title; }
      else {
        va = taskValues[a.id]?.[sortCol] || '';
        vb = taskValues[b.id]?.[sortCol] || '';
      }
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [visibleTasks, sortCol, sortDir, taskValues]);

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    addColumn(newColName.trim(), newColType);
    setNewColName('');
    setNewColType('text');
    setAddColOpen(false);
  };

  return (
    <div className="board-wrapper">
      <BoardHeader columns={columns} onAddColumn={() => setAddColOpen(true)} />

      {groups.map(group => {
        const groupTasks = sortCol
          ? sortedTasks.filter(t => t.group_id === group.id)
          : sortedTasks.filter(t => t.group_id === group.id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const isCollapsed = collapsedGroups[group.id] === true;

        return (
          <div key={group.id} className="board-group">
            <GroupHeader
              groupId={group.id}
              name={group.name}
              color={group.color}
              count={groupTasks.length}
              collapsed={isCollapsed}
            />

            {!isCollapsed && (
              <div className="board-group-body">
                {groupTasks.map(task => (
                  <BoardRow
                    key={task.id}
                    task={task}
                    columns={columns}
                    values={taskValues[task.id] || {}}
                    selected={!!selectedTasks[task.id]}
                  />
                ))}
                <AddItemRow groupId={group.id} colCount={columns.length} />
                <SummaryRow columns={columns} tasks={groupTasks} taskValues={taskValues} />
              </div>
            )}
          </div>
        );
      })}

      <Modal
        open={addColOpen}
        onClose={() => setAddColOpen(false)}
        title="Add Column"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddColOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddColumn}>Add</button>
          </>
        }
      >
        <div className="form-row">
          <label className="field-label">Column Name</label>
          <input
            className="input-field"
            placeholder="e.g. Priority"
            value={newColName}
            onChange={e => setNewColName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); }}
            autoFocus
          />
        </div>
        <div className="form-row">
          <label className="field-label">Type</label>
          <select className="select-field" value={newColType} onChange={e => setNewColType(e.target.value as typeof newColType)}>
            {COLUMN_TYPES.map(ct => (
              <option key={ct.type} value={ct.type}>{ct.label}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
