import { memo, useCallback } from 'react';
import StatusCell from './StatusCell';
import PersonCell from './PersonCell';
import DateCell from './DateCell';
import TextCell from './TextCell';
import NumberCell from './NumberCell';
import CheckboxCell from './CheckboxCell';
import type { BoardColumn } from '../../../stores/boardStore';

interface CellRendererProps {
  column: BoardColumn;
  value: string;
  taskId: string;
  onUpdate: (taskId: string, columnId: string, value: string) => void;
}

export default memo(function CellRenderer({ column, value, taskId, onUpdate }: CellRendererProps) {
  const handleChange = useCallback(
    (v: string) => onUpdate(taskId, column.id, v),
    [taskId, column.id, onUpdate]
  );

  switch (column.type) {
    case 'status':
    case 'priority':
      return <StatusCell value={value} onChange={handleChange} />;
    case 'person':
      return <PersonCell value={value} onChange={handleChange} />;
    case 'date':
    case 'timeline':
      return <DateCell value={value} onChange={handleChange} />;
    case 'number':
      return <NumberCell value={value} onChange={handleChange} />;
    case 'checkbox':
      return <CheckboxCell value={value} onChange={handleChange} />;
    case 'text':
    default:
      return <TextCell value={value} onChange={handleChange} />;
  }
});
