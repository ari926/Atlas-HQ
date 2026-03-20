import { memo, useCallback, useRef, useState } from 'react';
import PersonPicker from '../PersonPicker';
import { getInitials, personColor } from '../../../lib/utils';

interface PersonCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function PersonCell({ value, onChange }: PersonCellProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const getPickerPosition = () => {
    if (!cellRef.current) return { top: 0, left: 0 };
    const rect = cellRef.current.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left };
  };

  return (
    <div ref={cellRef} className="board-cell" onClick={openPicker} style={{ cursor: 'pointer' }}>
      {value ? (
        <span
          className="board-person-avatar"
          style={{ background: personColor(value) }}
          title={value}
        >
          {getInitials(value)}
        </span>
      ) : (
        <span className="board-person-empty">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
          </svg>
        </span>
      )}
      {pickerOpen && (
        <PersonPicker
          value={value}
          onSelect={onChange}
          onClose={() => setPickerOpen(false)}
          position={getPickerPosition()}
        />
      )}
    </div>
  );
});
