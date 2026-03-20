import { memo, useCallback, useRef, useState } from 'react';
import CellRenderer from './cells/CellRenderer';
import { useBoardStore, type BoardColumn, type Task } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';

interface BoardRowProps {
  task: Task;
  columns: BoardColumn[];
  values: Record<string, string>;
  selected: boolean;
}

export default memo(function BoardRow({ task, columns, values, selected }: BoardRowProps) {
  const { toggleTaskSelection, updateCellValue, updateTaskTitle } = useBoardStore();
  const openDetail = useUIStore(s => s.openDetail);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleTitleSave = useCallback(() => {
    const newTitle = titleRef.current?.value.trim();
    if (newTitle && newTitle !== task.title) {
      updateTaskTitle(task.id, newTitle);
    }
    setEditingTitle(false);
  }, [task.id, task.title, updateTaskTitle]);

  return (
    <div
      className={`board-row${selected ? ' selected' : ''}`}
      style={{
        gridTemplateColumns: `40px 280px ${columns.map(c => c.width + 'px').join(' ')} 40px`,
      }}
    >
      {/* Checkbox */}
      <div className="board-cell-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleTaskSelection(task.id)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
        />
      </div>

      {/* Task name */}
      <div className="board-cell-name" onDoubleClick={() => setEditingTitle(true)}>
        {editingTitle ? (
          <input
            ref={titleRef}
            type="text"
            className="board-cell-edit"
            defaultValue={task.title}
            autoFocus
            onBlur={handleTitleSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <span
            className="board-cell-name-text"
            onClick={() => openDetail(task.id)}
            style={{ cursor: 'pointer' }}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Dynamic columns */}
      {columns.map(col => (
        <CellRenderer
          key={col.id}
          column={col}
          value={values[col.id] || ''}
          taskId={task.id}
          onUpdate={updateCellValue}
        />
      ))}

      <div className="board-cell" />
    </div>
  );
});
