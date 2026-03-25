import { useState, useEffect, useCallback } from 'react';
import { FileCheck, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, daysUntil } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Certificate {
  id: string;
  policy_id: string;
  recipient_name: string;
  recipient_email: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Policy {
  id: string;
  policy_type: string;
  policy_number: string;
  carrier: string;
}

interface Props {
  policies: Policy[];
}

function certStatus(cert: Certificate): { label: string; cls: string } {
  const days = daysUntil(cert.expiry_date);
  if (days === null) return { label: 'No Expiry', cls: 'badge-pending' };
  if (days < 0) return { label: 'Expired', cls: 'badge-overdue' };
  if (days <= 30) return { label: 'Expiring Soon', cls: 'badge-due-soon' };
  return { label: 'Active', cls: 'badge-compliant' };
}

export default function InsuranceCertificates({ policies }: Props) {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const policyIds = policies.map(p => p.id);
    if (policyIds.length === 0) { setCerts([]); setLoading(false); return; }
    const { data } = await supabase
      .from('hq_insurance_certificates')
      .select('*')
      .in('policy_id', policyIds)
      .order('expiry_date', { ascending: true, nullsFirst: false });
    setCerts(data || []);
    setLoading(false);
  }, [policies]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('hq_insurance_certificates').insert({
      policy_id: fd.get('policy_id') as string,
      recipient_name: (fd.get('recipient_name') as string).trim(),
      recipient_email: (fd.get('recipient_email') as string)?.trim() || null,
      issue_date: fd.get('issue_date') as string || null,
      expiry_date: fd.get('expiry_date') as string || null,
      notes: (fd.get('notes') as string)?.trim() || null,
    });
    if (error) { toast.error('Failed to add certificate'); return; }
    toast.success('Certificate added');
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('hq_insurance_certificates').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Certificate deleted');
    load();
  };

  const policyLabel = (policyId: string) => {
    const p = policies.find(p => p.id === policyId);
    return p ? `${p.policy_type} (#${p.policy_number})` : 'Unknown';
  };

  if (loading) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <FileCheck size={16} /> Certificates of Insurance ({certs.length})
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Issue COI
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Policy</label>
              <select className="select-field" name="policy_id" required>
                {policies.filter(p => p.id).map(p => (
                  <option key={p.id} value={p.id}>{p.policy_type} — {p.carrier}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Recipient Name</label>
              <input className="input-field" name="recipient_name" required placeholder="e.g., ABC Dispensary" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Recipient Email</label>
              <input className="input-field" type="email" name="recipient_email" placeholder="contact@example.com" />
            </div>
            <div className="form-row">
              <label className="field-label">Issue Date</label>
              <input className="input-field" type="date" name="issue_date" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Expiry Date</label>
              <input className="input-field" type="date" name="expiry_date" />
            </div>
            <div className="form-row">
              <label className="field-label">Notes</label>
              <input className="input-field" name="notes" placeholder="Optional notes" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Issue</button>
          </div>
        </form>
      )}

      {certs.length === 0 ? (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-tx-muted)', padding: '1rem 0', textAlign: 'center' }}>
          No certificates issued yet
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Policy</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {certs.map(cert => {
                const status = certStatus(cert);
                return (
                  <tr key={cert.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{cert.recipient_name}</div>
                      {cert.recipient_email && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>{cert.recipient_email}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{policyLabel(cert.policy_id)}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{formatDate(cert.issue_date)}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{formatDate(cert.expiry_date)}</td>
                    <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)', padding: '0.25rem' }}
                        onClick={() => handleDelete(cert.id)}
                        title="Delete certificate"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
