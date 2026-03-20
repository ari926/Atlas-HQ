import { memo } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useBoardStore, type BoardColumn } from '../../stores/boardStore';

interface BoardHeaderProps {
  columns: BoardColumn[];
  onAddColumn: () => void;
}

export default memo(function BoardHeader({ columns, onAddColumn }: BoardHeaderProps) {
  const { sortCol, sortDir, toggleSort, selectAllTasks } = useBoardStore();

  return (
    <div
      className="board-header-row"
      style={{
        gridTemplateColumns: `40px 280px ${columns.map(c => c.width + 'px').join(' ')} 40px`,
      }}
    >
      <div className="board-col-header" style={{ borderRight: 'none' }}>
        <input
          type="checkbox"
          onChange={e => selectAllTasks(e.target.checked)}
          style={{ width: 14, height: 14, cursor: 'pointer' }}
        />
      </div>

      <div
        className={`board-col-header${sortCol === 'title' ? ' sorted' : ''}`}
        onClick={() => toggleSort('title')}
        style={{ cursor: 'pointer' }}
      >
        Item
        <span className="board-sort-icon">
          {sortCol === 'title'
            ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
            : <ChevronUp size={12} />}
        </span>
      </div>

      {columns.map(col => (
        <div
          key={col.id}
          className={`board-col-header${sortCol === col.id ? ' sorted' : ''}`}
          onClick={() => toggleSort(col.id)}
          style={{ cursor: 'pointer' }}
          title={col.name}
        >
          <span>{col.name}</span>
          <span className="board-sort-icon">
            {sortCol === col.id
              ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
              : <ChevronUp size={12} />}
          </span>
        </div>
      ))}

      <div className="board-add-col-btn" onClick={onAddColumn}>
        <Plus size={14} />
      </div>
    </div>
  );
});
