import { useEffect, useState } from 'react';
import { Search, Table2, Kanban, BarChart3, Clock, Plus, Settings, Trash2 } from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore, type ViewMode } from '../../stores/uiStore';
import BoardTable from './BoardTable';
import DetailPanel from './DetailPanel';
import KanbanView from '../Kanban/KanbanView';
import TimelineView from '../Timeline/TimelineView';
import DashboardBoardView from '../Dashboard/DashboardView';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';

const viewIcons: Record<ViewMode, typeof Table2> = {
  table: Table2,
  kanban: Kanban,
  timeline: Clock,
  dashboard: BarChart3,
};

export default function BoardView() {
  const {
    projects, currentProjectId, loading,
    loadProjects, selectProject, createProject, deleteProject,
    searchQuery, setSearchQuery, selectedTasks, clearSelection, deleteTasks,
    addGroup, tasks,
  } = useBoardStore();

  const { viewMode, setViewMode, detailTaskId } = useUIStore();

  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const selectedCount = Object.keys(selectedTasks).length;

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    const id = await createProject(newBoardName.trim());
    if (id) await selectProject(id);
    setNewBoardName('');
    setNewBoardOpen(false);
  };

  const handleBulkDelete = () => {
    deleteTasks(Object.keys(selectedTasks));
  };

  if (loading && projects.length === 0) {
    return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '4rem' }}>
        <Table2 size={64} strokeWidth={1} />
        <div className="empty-state-title">Create your first board</div>
        <div className="empty-state-text">Boards help you track projects, tasks, and everything in between.</div>
        <button className="btn btn-primary" onClick={() => setNewBoardOpen(true)}>+ New Board</button>
        <Modal open={newBoardOpen} onClose={() => setNewBoardOpen(false)} title="New Board" footer={
          <>
            <button className="btn btn-secondary" onClick={() => setNewBoardOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateBoard}>Create</button>
          </>
        }>
          <div className="form-row">
            <label className="field-label">Board Name</label>
            <input className="input-field" placeholder="e.g. Q2 Roadmap" value={newBoardName} onChange={e => setNewBoardName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreateBoard(); }} />
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      {/* Board selector */}
      <div className="board-selector">
        <select
          className="select-field"
          style={{ width: 'auto', minWidth: 200 }}
          value={currentProjectId || ''}
          onChange={e => selectProject(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="board-selector-separator" />
        <button className="btn btn-sm btn-ghost" title="Board Settings" onClick={() => setConfirmDelete(true)}>
          <Settings size={14} />
        </button>
        <div className="board-selector-separator" />
        <button className="btn btn-sm btn-primary" onClick={() => setNewBoardOpen(true)}>
          <Plus size={14} /> New Board
        </button>
        <span className="board-save-indicator">
          <span className="board-save-dot" /> Auto-saved
        </span>
      </div>

      {/* View toggle */}
      <div className="board-view-toggle">
        {(['table', 'kanban', 'timeline', 'dashboard'] as ViewMode[]).map(mode => {
          const Icon = viewIcons[mode];
          return (
            <button
              key={mode}
              className={`board-view-btn${viewMode === mode ? ' active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              <Icon size={14} /> {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Search & toolbar */}
      <div className="board-toolbar">
        <div className="board-search">
          <Search size={14} />
          <input
            className="board-search-input"
            placeholder="Search items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="board-item-count">
          {tasks.length} item{tasks.length !== 1 ? 's' : ''}
          {searchQuery && ' matching'}
        </span>
        <button className="btn btn-sm btn-ghost" onClick={() => addGroup('New Group')}>
          <Plus size={14} /> Group
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="board-bulk-bar active">
          <span className="board-bulk-count">{selectedCount} selected</span>
          <button className="board-bulk-btn danger" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="board-bulk-close" onClick={clearSelection}>&times;</button>
        </div>
      )}

      {/* View content */}
      {viewMode === 'table' && <BoardTable />}
      {viewMode === 'kanban' && <KanbanView />}
      {viewMode === 'timeline' && <TimelineView />}
      {viewMode === 'dashboard' && <DashboardBoardView />}

      {/* Detail panel */}
      {detailTaskId && <DetailPanel />}

      {/* Modals */}
      <Modal open={newBoardOpen} onClose={() => setNewBoardOpen(false)} title="New Board" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setNewBoardOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateBoard}>Create</button>
        </>
      }>
        <div className="form-row">
          <label className="field-label">Board Name</label>
          <input className="input-field" placeholder="e.g. Q2 Roadmap" value={newBoardName} onChange={e => setNewBoardName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreateBoard(); }} />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        message="Delete this board and all its data? This cannot be undone."
        confirmLabel="Delete Board"
        danger
        onConfirm={() => { if (currentProjectId) deleteProject(currentProjectId); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
