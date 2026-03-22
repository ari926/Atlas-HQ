import { useEffect, useState, useMemo } from 'react';
import { CreditCard, Plus, ExternalLink, Trash2, LayoutGrid, Table, Calendar as CalendarIcon, Phone, Mail, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil } from '../lib/utils';
import { useStateFilter } from '../stores/stateFilterStore';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LicenseEventLog from '../components/Licensing/LicenseEventLog';
import LicenseCalendar from '../components/Licensing/LicenseCalendar';
import LicenseCostSummary from '../components/Licensing/LicenseCostSummary';
import toast from 'react-hot-toast';

/* ─── Types ─── */
interface License {
  id: string;
  license_type: string;
  license_number: string | null;
  license_category: string | null;
  state: string;
  status: string;
  issued_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  issuing_authority: string | null;
  notes: string | null;
  document_url: string | null;
  application_fee: number | null;
  annual_fee: number | null;
  renewal_fee: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

/* ─── Constants ─── */
const STATES_MAP: Record<string, string> = {
  PA: 'Pennsylvania', OH: 'Ohio', MD: 'Maryland', NJ: 'New Jersey',
  MO: 'Missouri', WV: 'West Virginia', UT: 'Utah', NV: 'Nevada', Federal: 'Federal',
};
const STATES = Object.keys(STATES_MAP);

const LICENSE_CATEGORIES = [
  'Cannabis Transporter License',
  'Cannabis Distribution License',
  'Motor Carrier Permit (MCP)',
  'USDOT Number',
  'State Vehicle Registration',
  'Business Entity License',
  'Insurance Certificate (COI)',
  'Surety Bond',
  'Workers Comp Certificate',
];

type ViewMode = 'cards' | 'table' | 'calendar';

/* ─── Badge helper ─── */
function licenseBadge(l: License): { cls: string; text: string } {
  const days = daysUntil(l.expiration_date);
  if (l.status === 'Expired' || (days !== null && days < 0)) {
    return { cls: 'badge-expired', text: l.status === 'Expired' ? 'Expired' : `Expired ${days !== null ? Math.abs(days) : ''}d ago` };
  }
  if (l.status === 'Suspended' || l.status === 'Revoked') return { cls: 'badge-error', text: l.status };
  if (l.status === 'Pending Renewal') return { cls: 'badge-due-soon', text: 'Pending Renewal' };
  if (days !== null && days <= 30) return { cls: 'badge-due-soon', text: `Expires in ${days}d` };
  if (days !== null && days <= 90) return { cls: 'badge-due-soon', text: `Expires in ${days}d` };
  return { cls: 'badge-active', text: 'Active' };
}

/* ═══════════════════════════════════════════
   LICENSING PAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function LicensingPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLic, setEditLic] = useState<License | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<License | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const { activeState: stateFilter, setActiveState: setStateFilter } = useStateFilter();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* ─── Load ─── */
  const load = async () => {
    const { data, error } = await supabase.from('hq_licenses').select('*').order('expiration_date');
    if (error) { toast.error('Failed to load licenses'); }
    setLicenses(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ─── Filtered licenses ─── */
  const filtered = useMemo(() => {
    return licenses.filter(l => {
      if (stateFilter && l.state !== stateFilter) return false;
      if (categoryFilter && l.license_category !== categoryFilter) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      return true;
    });
  }, [licenses, stateFilter, categoryFilter, statusFilter]);

  /* ─── Group by state (for card view) ─── */
  const grouped = useMemo(() => {
    const g: Record<string, License[]> = {};
    STATES.forEach(s => { g[s] = []; });
    filtered.forEach(l => { if (g[l.state]) g[l.state].push(l); else { g[l.state] = [l]; } });
    return g;
  }, [filtered]);

  /* ─── Modal ─── */
  const openModal = (lic?: License) => { setEditLic(lic || null); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      license_type: fd.get('license_type') as string,
      license_category: fd.get('license_category') as string || null,
      license_number: fd.get('license_number') as string || null,
      state: fd.get('state') as string,
      status: fd.get('status') as string,
      issued_date: fd.get('issued_date') as string || null,
      expiration_date: fd.get('expiration_date') as string || null,
      renewal_date: fd.get('renewal_date') as string || null,
      issuing_authority: fd.get('issuing_authority') as string || null,
      notes: fd.get('notes') as string || null,
      document_url: fd.get('document_url') as string || null,
      application_fee: parseFloat(fd.get('application_fee') as string) || null,
      annual_fee: parseFloat(fd.get('annual_fee') as string) || null,
      renewal_fee: parseFloat(fd.get('renewal_fee') as string) || null,
      contact_name: fd.get('contact_name') as string || null,
      contact_email: fd.get('contact_email') as string || null,
      contact_phone: fd.get('contact_phone') as string || null,
    };
    if (editLic) {
      const { error } = await supabase.from('hq_licenses').update(payload).eq('id', editLic.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Updated');
    } else {
      const { error } = await supabase.from('hq_licenses').insert(payload);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Created');
    }
    setModalOpen(false);
    load();
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('hq_licenses').delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    setDeleteConfirm(null);
    setModalOpen(false);
    setEditLic(null);
    load();
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Licensing</h1>
          <p className="view-subtitle">Business licenses across {STATES.length} jurisdictions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')} title="Cards">
              <LayoutGrid size={14} />
            </button>
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title="Table">
              <Table size={14} />
            </button>
            <button className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')} title="Calendar">
              <CalendarIcon size={14} />
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
            <Plus size={14} /> Add License
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <LicenseCostSummary licenses={licenses} />

      {/* ─── Filters ─── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select className="select-field" value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">All States</option>
          {STATES.map(s => <option key={s} value={s}>{s} — {STATES_MAP[s]}</option>)}
        </select>
        <select className="select-field" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">All Categories</option>
          {LICENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Pending Renewal">Pending Renewal</option>
          <option value="Expired">Expired</option>
          <option value="Suspended">Suspended</option>
          <option value="Revoked">Revoked</option>
        </select>
        {(stateFilter || categoryFilter || statusFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStateFilter(''); setCategoryFilter(''); setStatusFilter(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* ─── Card View ─── */}
      {viewMode === 'cards' && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <CreditCard size={48} strokeWidth={1} />
              <div className="empty-state-title">No licenses</div>
              <div className="empty-state-text">Add your first business license to start tracking.</div>
            </div>
          ) : (
            STATES.map(state => {
              const stateLicenses = grouped[state];
              if (!stateLicenses || stateLicenses.length === 0) return null;
              return (
                <div key={state} className="state-group">
                  <div className="state-group-header">
                    <span className="state-badge">{state}</span>
                    <span className="state-group-title">{STATES_MAP[state]} ({stateLicenses.length})</span>
                  </div>
                  <div className="license-grid">
                    {stateLicenses.map(l => {
                      const { cls, text } = licenseBadge(l);
                      return (
                        <div key={l.id} className="license-card" onClick={() => openModal(l)} style={{ cursor: 'pointer' }}>
                          <div className="license-card-status"><span className={`badge ${cls}`}>{text}</span></div>
                          <div className="license-card-type">{l.license_category || l.license_type}</div>
                          <div className="license-card-number">{l.license_number || 'No number'}</div>
                          <div className="license-card-detail"><span>Issued</span><span>{formatDate(l.issued_date)}</span></div>
                          <div className="license-card-detail"><span>Expires</span><span>{formatDate(l.expiration_date)}</span></div>
                          {l.renewal_date && <div className="license-card-detail"><span>Renewal</span><span>{formatDate(l.renewal_date)}</span></div>}
                          {l.issuing_authority && <div className="license-card-detail"><span>Authority</span><span>{l.issuing_authority}</span></div>}
                          {(l.annual_fee || l.renewal_fee) && (
                            <div className="license-card-detail" style={{ color: 'var(--color-primary)' }}>
                              <span>Annual</span><span>${l.annual_fee || 0}</span>
                            </div>
                          )}
                          {l.document_url && (
                            <a href={l.document_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                              <ExternalLink size={12} /> View Document
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* ─── Table View ─── */}
      {viewMode === 'table' && (
        <div className="table-wrap" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Category</th>
                <th>Type</th>
                <th>Number</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Authority</th>
                <th>Annual Fee</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const { cls, text } = licenseBadge(l);
                return (
                  <tr key={l.id} onClick={() => openModal(l)} style={{ cursor: 'pointer' }}>
                    <td><span className="badge badge-primary">{l.state}</span></td>
                    <td style={{ fontSize: '0.75rem' }}>{l.license_category || '—'}</td>
                    <td>{l.license_type}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.license_number || '—'}</td>
                    <td><span className={`badge ${cls}`}>{text}</span></td>
                    <td style={{ fontSize: '0.75rem' }}>{formatDate(l.issued_date)}</td>
                    <td style={{ fontSize: '0.75rem' }}>{formatDate(l.expiration_date)}</td>
                    <td style={{ fontSize: '0.75rem' }}>{l.issuing_authority || '—'}</td>
                    <td style={{ fontSize: '0.75rem', textAlign: 'right' }}>{l.annual_fee ? `$${l.annual_fee}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Calendar View ─── */}
      {viewMode === 'calendar' && (
        <LicenseCalendar
          licenses={filtered}
          onSelect={(l) => openModal(l)}
          stateFilter={stateFilter}
          categoryFilter={categoryFilter}
        />
      )}

      {/* ─── Edit/Create Modal ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editLic ? 'Edit License' : 'New License'} wide>
        <form onSubmit={handleSave}>
          {/* Category + Type */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">License Category</label>
              <select className="select-field" name="license_category" defaultValue={editLic?.license_category || ''}>
                <option value="">— Select —</option>
                {LICENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">License Type (detail)</label>
              <input className="input-field" name="license_type" required defaultValue={editLic?.license_type || ''} placeholder="e.g., Class 3/4/6 Cannabis Transport" />
            </div>
          </div>

          {/* Number + State */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">License Number</label>
              <input className="input-field" name="license_number" defaultValue={editLic?.license_number || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">State</label>
              <select className="select-field" name="state" required defaultValue={editLic?.state || 'PA'}>
                {STATES.map(s => <option key={s} value={s}>{s} — {STATES_MAP[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="form-row">
            <label className="field-label">Status</label>
            <select className="select-field" name="status" defaultValue={editLic?.status || 'Active'}>
              <option value="Active">Active</option>
              <option value="Pending Renewal">Pending Renewal</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
              <option value="Revoked">Revoked</option>
            </select>
          </div>

          {/* Dates */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Issued Date</label>
              <input className="input-field" type="date" name="issued_date" defaultValue={editLic?.issued_date || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Expiration Date</label>
              <input className="input-field" type="date" name="expiration_date" defaultValue={editLic?.expiration_date || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Renewal Date</label>
              <input className="input-field" type="date" name="renewal_date" defaultValue={editLic?.renewal_date || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Issuing Authority</label>
              <input className="input-field" name="issuing_authority" defaultValue={editLic?.issuing_authority || ''} />
            </div>
          </div>

          {/* Costs */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Tracking</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-row">
                <label className="field-label">Application Fee</label>
                <input className="input-field" type="number" step="0.01" name="application_fee" defaultValue={editLic?.application_fee || ''} placeholder="$0" />
              </div>
              <div className="form-row">
                <label className="field-label">Annual Fee</label>
                <input className="input-field" type="number" step="0.01" name="annual_fee" defaultValue={editLic?.annual_fee || ''} placeholder="$0" />
              </div>
              <div className="form-row">
                <label className="field-label">Renewal Fee</label>
                <input className="input-field" type="number" step="0.01" name="renewal_fee" defaultValue={editLic?.renewal_fee || ''} placeholder="$0" />
              </div>
            </div>
          </div>

          {/* Authority Contact */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authority Contact</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-row">
                <label className="field-label"><User size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Contact Name</label>
                <input className="input-field" name="contact_name" defaultValue={editLic?.contact_name || ''} />
              </div>
              <div className="form-row">
                <label className="field-label"><Mail size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Email</label>
                <input className="input-field" type="email" name="contact_email" defaultValue={editLic?.contact_email || ''} />
              </div>
              <div className="form-row">
                <label className="field-label"><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Phone</label>
                <input className="input-field" name="contact_phone" defaultValue={editLic?.contact_phone || ''} />
              </div>
            </div>
          </div>

          {/* Document Link */}
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <label className="field-label">Document Link (Google Drive URL)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="input-field" name="document_url" defaultValue={editLic?.document_url || ''} placeholder="https://docs.google.com/..." style={{ flex: 1 }} />
              {editLic?.document_url && (
                <a href={editLic.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" title="Open document">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-row">
            <label className="field-label">Notes</label>
            <textarea className="input-field" name="notes" rows={2} defaultValue={editLic?.notes || ''} />
          </div>

          {/* Event Log (only for existing licenses) */}
          {editLic && <LicenseEventLog licenseId={editLic.id} />}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
            {editLic && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', color: 'var(--color-error)' }} onClick={() => setDeleteConfirm(editLic)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editLic ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete License"
        message={`Are you sure you want to delete "${deleteConfirm?.license_type}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
