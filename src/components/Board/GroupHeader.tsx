import { memo, useCallback, useRef, useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore';

interface GroupHeaderProps {
  groupId: string;
  name: string;
  color: string;
  count: number;
  collapsed: boolean;
}

export default memo(function GroupHeader({ groupId, name, color, count, collapsed }: GroupHeaderProps) {
  const { toggleGroupCollapse, updateGroupName, deleteGroup } = useBoardStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const nameRef = useRef<HTMLSpanElement>(null);

  const handleNameBlur = useCallback(() => {
    if (nameRef.current) {
      const newName = nameRef.current.textContent?.trim() || name;
      if (newName !== name) updateGroupName(groupId, newName);
    }
  }, [groupId, name, updateGroupName]);

  return (
    <div
      className="board-group-header"
      style={{ borderLeft: `6px solid ${color}`, background: `${color}20` }}
      onClick={() => toggleGroupCollapse(groupId)}
    >
      <span className={`board-group-toggle${collapsed ? ' collapsed' : ''}`}>
        <ChevronRight size={14} />
      </span>

      <span
        ref={nameRef}
        className="board-group-name"
        onClick={e => e.stopPropagation()}
        onDoubleClick={() => {
          if (nameRef.current) {
            nameRef.current.contentEditable = 'true';
            nameRef.current.focus();
          }
        }}
        onBlur={handleNameBlur}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.blur(); }
        }}
        suppressContentEditableWarning
      >
        {name}
      </span>

      <span className="board-group-count">
        {count} item{count !== 1 ? 's' : ''}
      </span>

      <button
        className="board-group-menu"
        onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen && (
        <div
          className="board-picker"
          style={{ top: '100%', right: 0, left: 'auto', minWidth: 140 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="board-picker-option"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { deleteGroup(groupId); setMenuOpen(false); }}
          >
            Delete Group
          </button>
          <button
            className="board-picker-option"
            onClick={() => setMenuOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
});
