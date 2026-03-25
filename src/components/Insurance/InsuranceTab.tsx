import { useEffect, useState, useMemo, useCallback } from 'react';
import { Trash2, ExternalLink, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, daysUntil, STATES } from '../../lib/utils';
import { useStateFilter } from '../../stores/stateFilterStore';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import InsuranceCostSummary from './InsuranceCostSummary';
import InsuranceCalendar from './InsuranceCalendar';
import InsuranceCoverageMatrix from './InsuranceCoverageMatrix';
import InsuranceEventLog from './InsuranceEventLog';
import InsuranceCertificates from './InsuranceCertificates';
import toast from 'react-hot-toast';

/* ─── Types ─── */
interface InsurancePolicy {
  id: string;
  policy_number: string;
  policy_type: string;
  carrier: string;
  state: string | null;
  coverage_amount: number | null;
  aggregate_limit: number | null;
  deductible: number | null;
  premium_annual: number | null;
  premium_monthly: number | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  status: string;
  agent_name: string | null;
  agent_email: string | null;
  agent_phone: string | null;
  broker_company: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Constants ─── */
const POLICY_TYPES = [
  'General Liability',
  'Commercial Auto',
  'Cargo / Goods in Transit',
  'Workers Compensation',
  'Professional Liability (E&O)',
  'Umbrella / Excess Liability',
  'Property',
  'Product Liability',
  'Cyber Liability',
  'Directors & Officers (D&O)',
  'Employment Practices (EPLI)',
  'Surety Bond',
];

const POLICY_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Cancelled', 'Pending'];

/* ─── Helpers ─── */
function computeAutoStatus(policy: InsurancePolicy): string {
  if (policy.status === 'Cancelled' || policy.status === 'Pending') return policy.status;
  const days = daysUntil(policy.expiration_date);
  if (days === null) return policy.status;
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Active';
}

function dotColor(status: string): string {
  if (status === 'Active') return 'green';
  if (status === 'Expiring Soon') return 'amber';
  if (status === 'Expired') return 'red';
  if (status === 'Cancelled') return 'gray';
  return 'blue';
}

function badgeClass(status: string): string {
  if (status === 'Active') return 'badge-compliant';
  if (status === 'Expiring Soon') return 'badge-due-soon';
  if (status === 'Expired') return 'badge-overdue';
  if (status === 'Cancelled') return 'badge-pending';
  return 'badge-in-progress';
}

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export type InsuranceViewMode = 'list' | 'calendar' | 'matrix';

interface TabProps {
  viewMode: InsuranceViewMode;
}

/* ═══════════════════════════════════════════
   INSURANCE TAB COMPONENT
   ═══════════════════════════════════════════ */
export default function InsuranceTab({ viewMode }: TabProps) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { activeState: stateFilter, setActiveState: setStateFilter } = useStateFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<InsurancePolicy | null>(null);

  /* ─── Load & Auto-Status ─── */
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('hq_insurance_policies')
      .select('*')
      .order('expiration_date', { ascending: true, nullsFirst: false });
    if (error) {
      toast.error('Failed to load insurance policies');
      setLoading(false);
      return;
    }
    const rows = (data || []) as InsurancePolicy[];

    // Auto-status: update stale statuses
    const updates: { id: string; status: string }[] = [];
    for (const policy of rows) {
      const computed = computeAutoStatus(policy);
      if (computed !== policy.status) {
        updates.push({ id: policy.id, status: computed });
        policy.status = computed;
      }
    }
    if (updates.length > 0) {
      for (const u of updates) {
        await supabase.from('hq_insurance_policies').update({ status: u.status }).eq('id', u.id);
      }
    }

    setPolicies(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Filtered ─── */
  const filtered = useMemo(() => policies.filter(p => {
    if (typeFilter && p.policy_type !== typeFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (stateFilter && p.state !== stateFilter) return false;
    return true;
  }), [policies, typeFilter, statusFilter, stateFilter]);

  /* ─── Modal ─── */
  const openModal = (policy?: InsurancePolicy) => {
    setEditPolicy(policy || null);
    setModalOpen(true);
  };

  /* ─── Save ─── */
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const toNum = (v: FormDataEntryValue | null) => {
      const s = (v as string)?.trim();
      if (!s) return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const payload: Record<string, unknown> = {
      policy_number: (fd.get('policy_number') as string).trim(),
      policy_type: fd.get('policy_type') as string,
      carrier: (fd.get('carrier') as string).trim(),
      state: (fd.get('state') as string) || null,
      coverage_amount: toNum(fd.get('coverage_amount')),
      aggregate_limit: toNum(fd.get('aggregate_limit')),
      deductible: toNum(fd.get('deductible')),
      premium_annual: toNum(fd.get('premium_annual')),
      premium_monthly: toNum(fd.get('premium_monthly')),
      effective_date: (fd.get('effective_date') as string) || null,
      expiration_date: (fd.get('expiration_date') as string) || null,
      renewal_date: (fd.get('renewal_date') as string) || null,
      status: fd.get('status') as string,
      agent_name: (fd.get('agent_name') as string)?.trim() || null,
      agent_email: (fd.get('agent_email') as string)?.trim() || null,
      agent_phone: (fd.get('agent_phone') as string)?.trim() || null,
      broker_company: (fd.get('broker_company') as string)?.trim() || null,
      document_url: (fd.get('document_url') as string)?.trim() || null,
      notes: (fd.get('notes') as string)?.trim() || null,
    };

    if (editPolicy) {
      const { error } = await supabase.from('hq_insurance_policies').update(payload).eq('id', editPolicy.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Policy updated');
    } else {
      const { error } = await supabase.from('hq_insurance_policies').insert(payload);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Policy created');
    }
    setModalOpen(false);
    load();
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('hq_insurance_policies').delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Policy deleted');
    setDeleteConfirm(null);
    setModalOpen(false);
    setEditPolicy(null);
    load();
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <>
      {/* ─── KPI Cards ─── */}
      <InsuranceCostSummary policies={policies} />

      {/* ─── Filter Bar ─── */}
      <div className="filter-bar">
        <select className="select-field" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Policy Types</option>
          {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {POLICY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select-field" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
          <option value="">All States</option>
          <option value="Company-wide">Company-wide</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ─── Calendar View ─── */}
      {viewMode === 'calendar' && (
        <InsuranceCalendar
          policies={policies}
          onSelect={(p) => openModal(p as InsurancePolicy)}
          typeFilter={typeFilter}
        />
      )}

      {/* ─── Matrix View ─── */}
      {viewMode === 'matrix' && (
        <InsuranceCoverageMatrix
          policies={policies}
          onCellClick={(policyType, state) => {
            setTypeFilter(policyType);
            setStateFilter(state);
          }}
        />
      )}

      {/* ─── Policy List ─── */}
      {viewMode === 'list' && (filtered.length === 0 ? (
        <div className="empty-state">
          <Shield size={48} strokeWidth={1} />
          <div className="empty-state-title">{policies.length === 0 ? 'No insurance policies' : 'No policies match filters'}</div>
          <div className="empty-state-text">{policies.length === 0 ? 'Add your first insurance policy to start tracking coverage.' : 'Try adjusting your filter criteria.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(policy => {
            const days = daysUntil(policy.expiration_date);
            let expiryText = '';
            if (policy.expiration_date) {
              expiryText = `Exp: ${formatDate(policy.expiration_date)}`;
              if (days !== null && days < 0) expiryText += ` (${Math.abs(days)}d overdue)`;
              else if (days === 0) expiryText += ' (Today)';
              else if (days !== null && days <= 90) expiryText += ` (${days}d)`;
            }
            return (
              <div key={policy.id} className="compliance-item" onClick={() => openModal(policy)}>
                <div className={`compliance-dot ${dotColor(policy.status)}`} />
                <div className="compliance-info">
                  <div className="compliance-title">{policy.policy_type}</div>
                  <div className="compliance-due">
                    <span style={{ fontWeight: 500, marginRight: '0.375rem' }}>{policy.carrier}</span>
                    <span className="badge badge-muted" style={{ marginRight: '0.375rem' }}>#{policy.policy_number}</span>
                    {policy.state && <span className="badge badge-primary" style={{ marginRight: '0.375rem' }}>{policy.state}</span>}
                    {policy.coverage_amount && (
                      <span style={{ marginRight: '0.375rem', opacity: 0.7, fontSize: 'var(--text-xs)' }}>
                        {formatCurrency(policy.coverage_amount)}
                      </span>
                    )}
                    {policy.document_url && (
                      <a
                        href={policy.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: '0.375rem', color: 'var(--color-primary)', opacity: 0.8 }}
                        title="View document"
                      >
                        <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </a>
                    )}
                    {expiryText}
                  </div>
                </div>
                <span className={`badge ${badgeClass(policy.status)}`}>{policy.status}</span>
              </div>
            );
          })}
        </div>
      ))}

      {/* ─── Certificates Section (list view only) ─── */}
      {viewMode === 'list' && policies.length > 0 && (
        <InsuranceCertificates policies={policies} />
      )}

      {/* ─── Add/Edit Modal ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editPolicy ? 'Edit Insurance Policy' : 'New Insurance Policy'} wide>
        <form onSubmit={handleSave}>
          {/* Policy Type + Carrier */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Policy Type</label>
              <select className="select-field" name="policy_type" defaultValue={editPolicy?.policy_type || 'General Liability'}>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Carrier</label>
              <input className="input-field" name="carrier" required defaultValue={editPolicy?.carrier || ''} placeholder="e.g., Hartford, Progressive" />
            </div>
          </div>

          {/* Policy Number + State */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Policy Number</label>
              <input className="input-field" name="policy_number" required defaultValue={editPolicy?.policy_number || ''} placeholder="e.g., GL-2026-001" />
            </div>
            <div className="form-row">
              <label className="field-label">State</label>
              <select className="select-field" name="state" defaultValue={editPolicy?.state || ''}>
                <option value="">—</option>
                <option value="Company-wide">Company-wide</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Coverage + Aggregate */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Coverage Amount ($)</label>
              <input className="input-field" type="number" name="coverage_amount" step="0.01" defaultValue={editPolicy?.coverage_amount ?? ''} placeholder="1000000" />
            </div>
            <div className="form-row">
              <label className="field-label">Aggregate Limit ($)</label>
              <input className="input-field" type="number" name="aggregate_limit" step="0.01" defaultValue={editPolicy?.aggregate_limit ?? ''} placeholder="2000000" />
            </div>
          </div>

          {/* Deductible + Status */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Deductible ($)</label>
              <input className="input-field" type="number" name="deductible" step="0.01" defaultValue={editPolicy?.deductible ?? ''} placeholder="5000" />
            </div>
            <div className="form-row">
              <label className="field-label">Status</label>
              <select className="select-field" name="status" defaultValue={editPolicy?.status || 'Active'}>
                {POLICY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Premium Annual + Monthly */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Annual Premium ($)</label>
              <input className="input-field" type="number" name="premium_annual" step="0.01" defaultValue={editPolicy?.premium_annual ?? ''} placeholder="12000" />
            </div>
            <div className="form-row">
              <label className="field-label">Monthly Premium ($)</label>
              <input className="input-field" type="number" name="premium_monthly" step="0.01" defaultValue={editPolicy?.premium_monthly ?? ''} placeholder="1000" />
            </div>
          </div>

          {/* Effective + Expiration */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Effective Date</label>
              <input className="input-field" type="date" name="effective_date" defaultValue={editPolicy?.effective_date || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Expiration Date</label>
              <input className="input-field" type="date" name="expiration_date" defaultValue={editPolicy?.expiration_date || ''} />
            </div>
          </div>

          {/* Renewal Date + Broker */}
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Renewal Date</label>
              <input className="input-field" type="date" name="renewal_date" defaultValue={editPolicy?.renewal_date || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Broker / Agency</label>
              <input className="input-field" name="broker_company" defaultValue={editPolicy?.broker_company || ''} placeholder="e.g., Marsh & McLennan" />
            </div>
          </div>

          {/* Agent Contact */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-tx-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent / Broker Contact
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="field-label">Agent Name</label>
                <input className="input-field" name="agent_name" defaultValue={editPolicy?.agent_name || ''} />
              </div>
              <div className="form-row">
                <label className="field-label">Agent Email</label>
                <input className="input-field" type="email" name="agent_email" defaultValue={editPolicy?.agent_email || ''} />
              </div>
            </div>
            <div className="form-row">
              <label className="field-label">Agent Phone</label>
              <input className="input-field" type="tel" name="agent_phone" defaultValue={editPolicy?.agent_phone || ''} placeholder="(555) 123-4567" />
            </div>
          </div>

          {/* Document Link */}
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <label className="field-label">Document Link (Certificate of Insurance)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="input-field" name="document_url" defaultValue={editPolicy?.document_url || ''} placeholder="https://docs.google.com/..." style={{ flex: 1 }} />
              {editPolicy?.document_url && (
                <a href={editPolicy.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" title="Open document">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-row">
            <label className="field-label">Notes</label>
            <textarea className="input-field" name="notes" rows={3} defaultValue={editPolicy?.notes || ''} />
          </div>

          {/* Claims & History */}
          {editPolicy && <InsuranceEventLog policyId={editPolicy.id} />}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
            {editPolicy && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', color: 'var(--color-error)' }} onClick={() => setDeleteConfirm(editPolicy)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editPolicy ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Insurance Policy"
        message={`Are you sure you want to delete the ${deleteConfirm?.policy_type} policy (#${deleteConfirm?.policy_number})? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
