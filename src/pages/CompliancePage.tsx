import { useEffect, useState, useMemo, useCallback } from 'react';
import { ShieldCheck, Plus, Grid3X3, List, Trash2, RotateCcw, FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil } from '../lib/utils';
import { useStateFilter } from '../stores/stateFilterStore';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { addMonths, addDays, addYears, format } from 'date-fns';

/* ─── Types ─── */
interface ComplianceItem {
  id: string;
  title: string;
  category: string;
  status: string;
  state: string | null;
  due_date: string | null;
  description: string | null;
  responsible_party: string | null;
  recurrence: string | null;
  recurrence_interval: number | null;
  evidence_date: string | null;
  evidence_ref: string | null;
  evidence_method: string | null;
  regulation_ref: string | null;
  document_url: string | null;
  parent_id: string | null;
  score_weight: number;
  created_at: string;
  updated_at: string;
}

/* ─── Cannabis Transportation Categories ─── */
const CATEGORIES = [
  'Seed-to-Sale / Metrc',
  'DOT / FMCSA',
  'Vehicle Compliance',
  'Drug Testing',
  'Background Checks',
  'State Cannabis Authority',
  'Regulatory',
  'Tax',
  'Insurance',
  'Reporting',
  'Safety',
  'Training',
];

const STATUSES = ['Compliant', 'In Progress', 'Due Soon', 'Overdue', 'Pending', 'Not Applicable'];
const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV', 'UT', 'NV'];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'None (one-time)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom interval' },
];

const EVIDENCE_METHODS = ['online', 'mail', 'in-person', 'email', 'phone', 'fax'];

type ViewMode = 'list' | 'matrix';

/* ─── Helpers ─── */
function computeAutoStatus(item: ComplianceItem): string {
  if (item.status === 'Not Applicable' || item.status === 'Compliant') return item.status;
  const days = daysUntil(item.due_date);
  if (days === null) return item.status;
  if (days < 0) return 'Overdue';
  if (days <= 30) return 'Due Soon';
  return item.status;
}

function getNextDueDate(dueDate: string, recurrence: string, interval?: number | null): string {
  const d = new Date(dueDate + 'T00:00:00');
  switch (recurrence) {
    case 'monthly': return format(addMonths(d, 1), 'yyyy-MM-dd');
    case 'quarterly': return format(addMonths(d, 3), 'yyyy-MM-dd');
    case 'semi_annual': return format(addMonths(d, 6), 'yyyy-MM-dd');
    case 'annual': return format(addYears(d, 1), 'yyyy-MM-dd');
    case 'custom': return format(addDays(d, interval || 30), 'yyyy-MM-dd');
    default: return format(addYears(d, 1), 'yyyy-MM-dd');
  }
}

function dotColor(status: string): string {
  if (status === 'Compliant') return 'green';
  if (status === 'Due Soon') return 'amber';
  if (status === 'Overdue') return 'red';
  if (status === 'In Progress') return 'blue';
  return 'gray';
}

function badgeClass(status: string): string {
  if (status === 'Compliant') return 'badge-compliant';
  if (status === 'Due Soon') return 'badge-due-soon';
  if (status === 'Overdue') return 'badge-overdue';
  if (status === 'In Progress') return 'badge-in-progress';
  return 'badge-pending';
}

function matrixCellStatus(items: ComplianceItem[]): 'green' | 'yellow' | 'red' | 'none' {
  if (items.length === 0) return 'none';
  if (items.some(i => i.status === 'Overdue')) return 'red';
  if (items.some(i => i.status === 'Due Soon' || i.status === 'In Progress')) return 'yellow';
  if (items.every(i => i.status === 'Compliant' || i.status === 'Not Applicable')) return 'green';
  return 'yellow';
}

/* ─── Compliance Score ─── */
function calcScore(items: ComplianceItem[], stateFilter?: string): { score: number; compliant: number; total: number } {
  const applicable = items.filter(i => {
    if (i.status === 'Not Applicable') return false;
    if (stateFilter && i.state !== stateFilter) return false;
    return true;
  });
  if (applicable.length === 0) return { score: 100, compliant: 0, total: 0 };
  const totalWeight = applicable.reduce((s, i) => s + (i.score_weight || 1), 0);
  const compliantWeight = applicable.filter(i => i.status === 'Compliant').reduce((s, i) => s + (i.score_weight || 1), 0);
  return {
    score: totalWeight > 0 ? Math.round((compliantWeight / totalWeight) * 100) : 0,
    compliant: applicable.filter(i => i.status === 'Compliant').length,
    total: applicable.length,
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-error)';
}

/* ═══════════════════════════════════════════
   COMPLIANCE PAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function CompliancePage() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { activeState: stateFilter, setActiveState: setStateFilter } = useStateFilter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ComplianceItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ComplianceItem | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  /* ─── Load & Auto-Status ─── */
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('hq_compliance_items')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) {
      toast.error('Failed to load compliance items');
      setLoading(false);
      return;
    }
    const rows = (data || []) as ComplianceItem[];

    // Auto-status: update any items that should be Overdue or Due Soon
    const updates: { id: string; status: string }[] = [];
    for (const item of rows) {
      const computed = computeAutoStatus(item);
      if (computed !== item.status) {
        updates.push({ id: item.id, status: computed });
        item.status = computed;
      }
    }
    if (updates.length > 0) {
      for (const u of updates) {
        await supabase.from('hq_compliance_items').update({ status: u.status }).eq('id', u.id);
      }
    }

    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Filtered items ─── */
  const filtered = useMemo(() => items.filter(item => {
    if (catFilter && item.category !== catFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (stateFilter && item.state !== stateFilter) return false;
    return true;
  }), [items, catFilter, statusFilter, stateFilter]);

  /* ─── Compliance Scores ─── */
  const overallScore = useMemo(() => calcScore(items), [items]);
  const stateScores = useMemo(() => {
    const scores: Record<string, ReturnType<typeof calcScore>> = {};
    for (const st of STATES) {
      scores[st] = calcScore(items, st);
    }
    return scores;
  }, [items]);

  /* ─── Status counts ─── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const item of items) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [items]);

  /* ─── Modal ─── */
  const openModal = (item?: ComplianceItem) => {
    setEditItem(item || null);
    setShowEvidence(!!(item?.evidence_date || item?.evidence_ref || item?.evidence_method));
    setModalOpen(true);
  };

  /* ─── Save ─── */
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newStatus = fd.get('status') as string;
    const recurrence = fd.get('recurrence') as string || null;

    const payload: Record<string, unknown> = {
      title: fd.get('title') as string,
      category: fd.get('category') as string,
      status: newStatus,
      state: fd.get('state') as string || null,
      due_date: fd.get('due_date') as string || null,
      description: fd.get('description') as string || null,
      responsible_party: fd.get('responsible_party') as string || null,
      recurrence: recurrence || null,
      recurrence_interval: recurrence === 'custom' ? parseInt(fd.get('recurrence_interval') as string) || 30 : null,
      evidence_date: fd.get('evidence_date') as string || null,
      evidence_ref: fd.get('evidence_ref') as string || null,
      evidence_method: fd.get('evidence_method') as string || null,
      regulation_ref: fd.get('regulation_ref') as string || null,
      document_url: fd.get('document_url') as string || null,
      score_weight: parseInt(fd.get('score_weight') as string) || 1,
    };

    if (editItem) {
      const { error } = await supabase.from('hq_compliance_items').update(payload).eq('id', editItem.id);
      if (error) { toast.error('Failed to update'); return; }

      // Recurring: if status changed to Compliant and item has recurrence, auto-create next
      if (newStatus === 'Compliant' && editItem.status !== 'Compliant' && recurrence && payload.due_date) {
        const nextDue = getNextDueDate(payload.due_date as string, recurrence, payload.recurrence_interval as number);
        const nextPayload = {
          title: payload.title,
          category: payload.category,
          status: 'Pending',
          state: payload.state,
          due_date: nextDue,
          description: payload.description,
          responsible_party: payload.responsible_party,
          recurrence: payload.recurrence,
          recurrence_interval: payload.recurrence_interval,
          regulation_ref: payload.regulation_ref,
          score_weight: payload.score_weight,
          parent_id: editItem.parent_id || editItem.id,
        };
        const { error: insertErr } = await supabase.from('hq_compliance_items').insert(nextPayload);
        if (!insertErr) {
          toast.success(`Next occurrence created: due ${formatDate(nextDue)}`);
        }
      }

      toast.success('Updated');
    } else {
      const { error } = await supabase.from('hq_compliance_items').insert(payload);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Created');
    }
    setModalOpen(false);
    load();
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('hq_compliance_items').delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    setDeleteConfirm(null);
    setModalOpen(false);
    setEditItem(null);
    load();
  };

  /* ─── Matrix Data ─── */
  const matrixData = useMemo(() => {
    const matrix: Record<string, Record<string, ComplianceItem[]>> = {};
    for (const cat of CATEGORIES) {
      matrix[cat] = {};
      for (const st of STATES) {
        matrix[cat][st] = items.filter(i => i.category === cat && i.state === st);
      }
    }
    return matrix;
  }, [items]);

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Compliance</h1>
          <p className="view-subtitle">Cannabis transportation compliance tracking across {STATES.length} states</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="board-view-toggle">
            <button className={`board-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <List size={14} /> List
            </button>
            <button className={`board-view-btn${viewMode === 'matrix' ? ' active' : ''}`} onClick={() => setViewMode('matrix')}>
              <Grid3X3 size={14} /> Matrix
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {/* ─── Score Cards ─── */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-label">Overall Score</div>
          <div className="kpi-value" style={{ color: scoreColor(overallScore.score) }}>
            {overallScore.total > 0 ? `${overallScore.score}%` : '—'}
          </div>
          <div className="kpi-delta">{overallScore.compliant} of {overallScore.total} items compliant</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value" style={{ color: statusCounts['Overdue'] > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
            {statusCounts['Overdue']}
          </div>
          <div className="kpi-delta">items need attention</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Due Soon</div>
          <div className="kpi-value" style={{ color: statusCounts['Due Soon'] > 0 ? 'var(--color-warning)' : 'var(--color-tx)' }}>
            {statusCounts['Due Soon']}
          </div>
          <div className="kpi-delta">within 30 days</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{items.length}</div>
          <div className="kpi-delta">across {STATES.length} states</div>
        </div>
      </div>

      {/* ─── State Score Chips ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATES.map(st => {
          const s = stateScores[st];
          return (
            <button
              key={st}
              className={`badge ${stateFilter === st ? 'badge-primary' : 'badge-muted'}`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.625rem', border: 'none', fontSize: 'var(--text-xs)' }}
              onClick={() => setStateFilter(stateFilter === st ? '' : st)}
            >
              {st}: {s.total > 0 ? `${s.score}%` : '—'}
            </button>
          );
        })}
        {stateFilter && (
          <button
            className="badge badge-muted"
            style={{ cursor: 'pointer', padding: '0.25rem 0.625rem', border: 'none', fontSize: 'var(--text-xs)' }}
            onClick={() => setStateFilter('')}
          >
            Clear
          </button>
        )}
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="filter-bar">
        <select className="select-field" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select-field" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
          <option value="">All States</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ─── List View ─── */}
      {viewMode === 'list' && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={48} strokeWidth={1} />
              <div className="empty-state-title">{items.length === 0 ? 'No compliance items' : 'No items match filters'}</div>
              <div className="empty-state-text">{items.length === 0 ? 'Add your first compliance requirement to start tracking.' : 'Try adjusting your filter criteria.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtered.map(item => {
                const days = daysUntil(item.due_date);
                let dueText = '';
                if (item.due_date) {
                  dueText = `Due: ${formatDate(item.due_date)}`;
                  if (days !== null && days < 0) dueText += ` (${Math.abs(days)} days overdue)`;
                  else if (days === 0) dueText += ' (Due today)';
                  else if (days !== null && days <= 30) dueText += ` (${days} days)`;
                }
                return (
                  <div key={item.id} className="compliance-item" onClick={() => openModal(item)}>
                    <div className={`compliance-dot ${dotColor(item.status)}`} />
                    <div className="compliance-info">
                      <div className="compliance-title">
                        {item.title}
                        {item.recurrence && <RotateCcw size={12} style={{ display: 'inline', marginLeft: '0.375rem', opacity: 0.5 }} />}
                      </div>
                      <div className="compliance-due">
                        <span className="badge badge-muted" style={{ marginRight: '0.375rem' }}>{item.category}</span>
                        {item.state && <span className="badge badge-primary" style={{ marginRight: '0.375rem' }}>{item.state}</span>}
                        {item.regulation_ref && (
                          <span style={{ marginRight: '0.375rem', opacity: 0.6 }}>
                            <FileText size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {item.regulation_ref}
                          </span>
                        )}
                        {item.document_url && (
                          <a
                            href={item.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginRight: '0.375rem', color: 'var(--color-primary)', opacity: 0.8 }}
                            title="View document"
                          >
                            <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                          </a>
                        )}
                        {dueText}
                      </div>
                    </div>
                    <span className={`badge ${badgeClass(item.status)}`}>{item.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Matrix View ─── */}
      {viewMode === 'matrix' && (
        <div className="table-wrap" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 180, position: 'sticky', left: 0, background: 'var(--color-surface-offset)', zIndex: 2 }}>Category</th>
                {STATES.map(st => (
                  <th key={st} style={{ textAlign: 'center', minWidth: 90 }}>{st}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => (
                <tr key={cat}>
                  <td style={{ fontWeight: 500, fontSize: 'var(--text-xs)', position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>{cat}</td>
                  {STATES.map(st => {
                    const cellItems = matrixData[cat][st];
                    const cellStatus = matrixCellStatus(cellItems);
                    return (
                      <td key={st} style={{ textAlign: 'center', padding: '0.5rem' }}>
                        {cellItems.length > 0 ? (
                          <button
                            className="compliance-matrix-cell"
                            data-status={cellStatus}
                            onClick={() => { setCatFilter(cat); setStateFilter(st); setViewMode('list'); }}
                            title={`${cellItems.length} item${cellItems.length > 1 ? 's' : ''} — click to view`}
                          >
                            {cellItems.length}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Score row */}
              <tr style={{ borderTop: '2px solid var(--color-divider)' }}>
                <td style={{ fontWeight: 600, fontSize: 'var(--text-xs)', position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>Score</td>
                {STATES.map(st => {
                  const s = stateScores[st];
                  return (
                    <td key={st} style={{ textAlign: 'center', fontWeight: 600, fontSize: 'var(--text-xs)', color: s.total > 0 ? scoreColor(s.score) : 'var(--color-tx-faint)' }}>
                      {s.total > 0 ? `${s.score}%` : '—'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Compliance Item' : 'New Compliance Item'} wide>
        <form onSubmit={handleSave}>
          {/* Title */}
          <div className="form-row">
            <label className="field-label">Title</label>
            <input className="input-field" name="title" required defaultValue={editItem?.title || ''} placeholder="e.g., PA Metrc Quarterly Reconciliation" />
          </div>

          {/* Category + Status */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Category</label>
              <select className="select-field" name="category" defaultValue={editItem?.category || 'Regulatory'}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Status</label>
              <select className="select-field" name="status" defaultValue={editItem?.status || 'Pending'}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* State + Due Date */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">State</label>
              <select className="select-field" name="state" defaultValue={editItem?.state || ''}>
                <option value="">—</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Due Date</label>
              <input className="input-field" type="date" name="due_date" defaultValue={editItem?.due_date || ''} />
            </div>
          </div>

          {/* Recurrence + Weight */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Recurrence</label>
              <select className="select-field" name="recurrence" defaultValue={editItem?.recurrence || ''}>
                {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Score Weight</label>
              <input className="input-field" type="number" name="score_weight" min="1" max="10" defaultValue={editItem?.score_weight || 1} />
            </div>
          </div>

          {/* Custom interval (shown only when recurrence=custom — controlled via CSS) */}
          <div className="form-row" id="custom-interval-row">
            <label className="field-label">Custom Interval (days)</label>
            <input className="input-field" type="number" name="recurrence_interval" min="1" defaultValue={editItem?.recurrence_interval || 30} />
          </div>

          {/* Responsible + Regulation Ref */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Responsible Party</label>
              <input className="input-field" name="responsible_party" defaultValue={editItem?.responsible_party || ''} placeholder="e.g., Compliance Officer" />
            </div>
            <div className="form-row">
              <label className="field-label">Regulation Reference</label>
              <input className="input-field" name="regulation_ref" defaultValue={editItem?.regulation_ref || ''} placeholder="e.g., 35 P.S. 10231.702" />
            </div>
          </div>

          {/* Document Link */}
          <div className="form-row">
            <label className="field-label">Document Link (Google Drive URL)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="input-field" name="document_url" defaultValue={editItem?.document_url || ''} placeholder="https://docs.google.com/..." style={{ flex: 1 }} />
              {editItem?.document_url && (
                <a href={editItem.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" title="Open document">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="form-row">
            <label className="field-label">Description</label>
            <textarea className="input-field" name="description" rows={3} defaultValue={editItem?.description || ''} />
          </div>

          {/* Evidence Section (collapsible) */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowEvidence(!showEvidence)}
              style={{ marginBottom: showEvidence ? '0.75rem' : 0, color: 'var(--color-tx-muted)' }}
            >
              <AlertTriangle size={14} /> {showEvidence ? 'Hide' : 'Show'} Evidence / Proof
            </button>
            {showEvidence && (
              <>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="field-label">Evidence Date</label>
                    <input className="input-field" type="date" name="evidence_date" defaultValue={editItem?.evidence_date || ''} />
                  </div>
                  <div className="form-row">
                    <label className="field-label">Filing Method</label>
                    <select className="select-field" name="evidence_method" defaultValue={editItem?.evidence_method || ''}>
                      <option value="">—</option>
                      {EVIDENCE_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <label className="field-label">Confirmation / Reference Number</label>
                  <input className="input-field" name="evidence_ref" defaultValue={editItem?.evidence_ref || ''} placeholder="e.g., CONF-2026-03-001" />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
            {editItem && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', color: 'var(--color-error)' }} onClick={() => setDeleteConfirm(editItem)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editItem ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Compliance Item"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
