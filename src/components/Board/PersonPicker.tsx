import { useEffect, useRef, useState } from 'react';
import { useBoardStore, type StaffMember } from '../../stores/boardStore';
import { getInitials, personColor } from '../../lib/utils';

interface PersonPickerProps {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export default function PersonPicker({ value, onSelect, onClose, position }: PersonPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const staff = useBoardStore(s => s.staff);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = staff.filter((s: StaffMember) => {
    if (!search) return true;
    const name = `${s.first_name || ''} ${s.last_name || ''} ${s.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div ref={ref} className="board-picker" style={{ top: position.top, left: position.left }}>
      <input
        className="board-picker-search"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />
      {filtered.map((s) => {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email;
        return (
          <button
            key={s.id}
            className={`board-picker-option${value === name ? ' active' : ''}`}
            onClick={() => { onSelect(name); onClose(); }}
          >
            <span
              className="board-person-avatar"
              style={{ background: personColor(s.id), width: 24, height: 24, fontSize: '0.6rem' }}
            >
              {getInitials(name)}
            </span>
            {name}
          </button>
        );
      })}
      <button
        className="board-picker-option"
        style={{ color: 'var(--color-tx-faint)' }}
        onClick={() => { onSelect(''); onClose(); }}
      >
        Unassign
      </button>
    </div>
  );
}
