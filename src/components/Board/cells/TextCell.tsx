import { memo, useRef, useState } from 'react';

interface TextCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function TextCell({ value, onChange }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (editing) {
    return (
      <div className="board-cell">
        <input
          ref={inputRef}
          type="text"
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
