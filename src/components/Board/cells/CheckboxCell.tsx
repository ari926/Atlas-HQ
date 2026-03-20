import { memo } from 'react';

interface CheckboxCellProps {
  value: string;
  onChange: (value: string) => void;
}

export default memo(function CheckboxCell({ value, onChange }: CheckboxCellProps) {
  const checked = value === 'true' || value === '1';

  return (
    <div className="board-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(checked ? '' : 'true')}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
      />
    </div>
  );
});
