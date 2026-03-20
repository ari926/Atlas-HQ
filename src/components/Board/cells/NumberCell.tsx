import { memo, useState } from 'react';

interface NumberCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function NumberCell({ value, onChange }: NumberCellProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="board-cell">
        <input
          type="number"
          className="board-cell-edit"
          defaultValue={value || ''}
          autoFocus
          onBlur={(e) => {
            if (e.target.value !== value) onChange(e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if ((e.target as HTMLInputElement).value !== value) onChange((e.target as HTMLInputElement).value);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="board-cell" onClick={() => setEditing(true)} style={{ cursor: 'text' }}>
      <span className="board-cell-text">{value || ''}</span>
    </div>
  );
});
