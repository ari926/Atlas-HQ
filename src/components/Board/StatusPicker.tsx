import { useEffect, useRef } from 'react';
import { isLightColor } from '../../lib/utils';

const DEFAULT_STATUSES = [
  { label: 'Working on it', color: '#fdab3d' },
  { label: 'Done', color: '#00c875' },
  { label: 'Stuck', color: '#e2445c' },
  { label: 'Not Started', color: '#c4c4c4' },
  { label: 'In Review', color: '#579bfc' },
  { label: 'Waiting', color: '#a25ddc' },
];

interface StatusPickerProps {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
  statuses?: { label: string; color: string }[];
}

export default function StatusPicker({ value, onSelect, onClose, position, statuses }: StatusPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const items = statuses || DEFAULT_STATUSES;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="board-picker" style={{ top: position.top, left: position.left }}>
      {items.map((s) => (
        <button
          key={s.label}
          className={`board-picker-option${value === s.label ? ' active' : ''}`}
          onClick={() => { onSelect(s.label); onClose(); }}
        >
          <span
            className="board-picker-dot"
            style={{ background: s.color, color: isLightColor(s.color) ? '#333' : '#fff' }}
          />
          {s.label}
        </button>
      ))}
      <button
        className="board-picker-option"
        style={{ color: 'var(--color-tx-faint)' }}
        onClick={() => { onSelect(''); onClose(); }}
      >
        Clear
      </button>
    </div>
  );
}
