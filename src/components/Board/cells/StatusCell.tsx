import { memo, useCallback, useRef, useState } from 'react';
import StatusPicker from '../StatusPicker';
import { isLightColor } from '../../../lib/utils';

const STATUS_COLORS: Record<string, string> = {
  'Working on it': '#fdab3d',
  'Done': '#00c875',
  'Stuck': '#e2445c',
  'Not Started': '#c4c4c4',
  'In Review': '#579bfc',
  'Waiting': '#a25ddc',
};

interface StatusCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function StatusCell({ value, onChange }: StatusCellProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const color = STATUS_COLORS[value] || '#c4c4c4';

  const getPickerPosition = () => {
    if (!cellRef.current) return { top: 0, left: 0 };
    const rect = cellRef.current.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left };
  };

  return (
    <div ref={cellRef} className="board-cell" onClick={openPicker} style={{ cursor: 'pointer' }}>
      {value ? (
        <span
          className={`board-status-pill${isLightColor(color) ? ' light-bg' : ''}`}
          style={{ background: color }}
        >
          {value}
        </span>
      ) : (
        <span className="board-status-empty" />
      )}
      {pickerOpen && (
        <StatusPicker
          value={value}
          onSelect={onChange}
          onClose={() => setPickerOpen(false)}
          position={getPickerPosition()}
        />
      )}
    </div>
  );
});
