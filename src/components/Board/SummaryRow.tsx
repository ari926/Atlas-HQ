import { memo } from 'react';
import type { BoardColumn, Task } from '../../stores/boardStore';

interface SummaryRowProps {
  columns: BoardColumn[];
  tasks: Task[];
  taskValues: Record<string, Record<string, string>>;
}

export default memo(function SummaryRow({ columns, tasks, taskValues }: SummaryRowProps) {
  return (
    <div
      className="board-summary-row"
      style={{
        gridTemplateColumns: `40px 280px ${columns.map(c => c.width + 'px').join(' ')} 40px`,
      }}
    >
      <div className="board-summary-cell" />
      <div className="board-summary-cell" style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)' }}>
        {tasks.length} item{tasks.length !== 1 ? 's' : ''}
      </div>
      {columns.map(col => {
        let summary = '';
        if (col.type === 'number') {
          const nums = tasks
            .map(t => parseFloat(taskValues[t.id]?.[col.id] || ''))
            .filter(n => !isNaN(n));
          if (nums.length > 0) {
            summary = nums.reduce((a, b) => a + b, 0).toLocaleString();
          }
        }
        return (
          <div key={col.id} className="board-summary-cell" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-faint)' }}>
            {summary}
          </div>
        );
      })}
      <div className="board-summary-cell" />
    </div>
  );
});
