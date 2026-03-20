import { memo, useRef, useState } from 'react';
import { formatDateShort } from '../../../lib/utils';

interface DateCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function DateCell({ value, onChange }: DateCellProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (editing) {
    return (
      <div className="board-cell">
        <input
          ref={inputRef}
          type="date"
          className="board-date-input"
          defaultValue={value || ''}
          autoFocus
          onBlur={(e) => {
            onChange(e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange((e.target as HTMLInputElement).value);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="board-cell" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
      {value ? (
        <span className="board-date-display">{formatDateShort(value)}</span>
      ) : (
        <span className="board-date-display" style={{ color: 'var(--color-tx-faint)' }}>—</span>
      )}
    </div>
  );
});
