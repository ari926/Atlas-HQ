import { useEffect, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil } from '../lib/utils';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';

interface License {
  id: string;
  license_type: string;
  license_number: string | null;
  state: string;
  status: string;
  issued_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  issuing_authority: string | null;
}

const STATES_MAP: Record<string, string> = { PA: 'Pennsylvania', OH: 'Ohio', MD: 'Maryland', NJ: 'New Jersey', MO: 'Missouri', WV: 'West Virginia' };
const STATES = Object.keys(STATES_MAP);

export default function LicensingPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLic, setEditLic] = useState<License | null>(null);

  const load = async () => {
    const { data } = await supabase.from('hq_licenses').select('*').order('expiration_date');
    setLicenses(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openModal = (lic?: License) => { setEditLic(lic || null); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      license_type: fd.get('license_type') as string,
      license_number: fd.get('license_number') as string || null,
      state: fd.get('state') as string,
      status: fd.get('status') as string,
      issued_date: fd.get('issued_date') as string || null,
      expiration_date: fd.get('expiration_date') as string || null,
      renewal_date: fd.get('renewal_date') as string || null,
      issuing_authority: fd.get('issuing_authority') as string || null,
    };
    if (editLic) {
      await supabase.from('hq_licenses').update(payload).eq('id', editLic.id);
    } else {
      await supabase.from('hq_licenses').insert(payload);
    }
    toast.success(editLic ? 'Updated' : 'Created');
    setModalOpen(false);
    load();
  };

  // Group by state
  const grouped: Record<string, License[]> = {};
  STATES.forEach(s => { grouped[s] = []; });
  licenses.forEach(l => { if (grouped[l.state]) grouped[l.state].push(l); });

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Licensing</h1>
          <p className="view-subtitle">Business licenses across all states</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
          <Plus size={14} /> Add License
        </button>
      </div>

      {licenses.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} strokeWidth={1} />
          <div className="empty-state-title">No licenses</div>
          <div className="empty-state-text">Add your first business license to start tracking.</div>
        </div>
      ) : (
        STATES.map(state => {
          const stateLicenses = grouped[state];
          if (stateLicenses.length === 0) return null;
          return (
            <div key={state} className="state-group">
              <div className="state-group-header">
                <span className="state-badge">{state}</span>
                <span className="state-group-title">{STATES_MAP[state]} ({stateLicenses.length})</span>
              </div>
              <div className="license-grid">
                {stateLicenses.map(l => {
                  const days = daysUntil(l.expiration_date);
                  let badgeCls: string, badgeText: string;
                  if (l.status === 'Expired' || (days !== null && days < 0)) {
                    badgeCls = 'badge-expired';
                    badgeText = l.status === 'Expired' ? 'Expired' : `Expired ${days !== null ? Math.abs(days) : ''}d ago`;
                  } else if (l.status === 'Suspended' || l.status === 'Revoked') {
                    badgeCls = 'badge-error';
                    badgeText = l.status;
                  } else if (l.status === 'Pending Renewal') {
                    badgeCls = 'badge-due-soon';
                    badgeText = 'Pending Renewal';
                  } else if (days !== null && days <= 30) {
                    badgeCls = 'badge-due-soon';
                    badgeText = `Expires in ${days}d`;
                  } else {
                    badgeCls = 'badge-active';
                    badgeText = 'Active';
                  }
                  return (
                    <div key={l.id} className="license-card" onClick={() => openModal(l)} style={{ cursor: 'pointer' }}>
                      <div className="license-card-status"><span className={`badge ${badgeCls}`}>{badgeText}</span></div>
                      <div className="license-card-type">{l.license_type}</div>
                      <div className="license-card-number">{l.license_number || 'No number'}</div>
                      <div className="license-card-detail"><span>Issued</span><span>{formatDate(l.issued_date)}</span></div>
                      <div className="license-card-detail"><span>Expires</span><span>{formatDate(l.expiration_date)}</span></div>
                      {l.renewal_date && <div className="license-card-detail"><span>Renewal</span><span>{formatDate(l.renewal_date)}</span></div>}
                      {l.issuing_authority && <div className="license-card-detail"><span>Authority</span><span>{l.issuing_authority}</span></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editLic ? 'Edit License' : 'New License'}>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label className="field-label">License Type</label>
            <input className="input-field" name="license_type" required defaultValue={editLic?.license_type || ''} />
          </div>
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
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editLic ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
