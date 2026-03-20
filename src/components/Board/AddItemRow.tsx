import { memo, useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore';

interface AddItemRowProps {
  groupId: string;
  colCount: number;
}

export default memo(function AddItemRow({ groupId, colCount }: AddItemRowProps) {
  const [value, setValue] = useState('');
  const addTask = useBoardStore(s => s.addTask);

  const handleAdd = async () => {
    const title = value.trim();
    if (!title) return;
    await addTask(groupId, title);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div
      className="board-add-item"
      style={{
        gridTemplateColumns: `40px 280px repeat(${colCount}, 1fr) 40px`,
      }}
    >
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem' }}>
        <Plus size={14} style={{ color: 'var(--color-tx-faint)', flexShrink: 0 }} />
        <input
          className="board-add-item-input"
          placeholder="+ Add item"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (value.trim()) handleAdd(); }}
        />
      </div>
    </div>
  );
});
