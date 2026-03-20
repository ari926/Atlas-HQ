import { useEffect, useState } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil } from '../lib/utils';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';

interface ComplianceItem {
  id: string;
  title: string;
  category: string;
  status: string;
  state: string | null;
  due_date: string | null;
  description: string | null;
  responsible_party: string | null;
}

const CATEGORIES = ['Regulatory', 'Tax', 'Insurance', 'Reporting', 'Safety', 'Training', 'Other'];
const STATUSES = ['Compliant', 'In Progress', 'Due Soon', 'Overdue', 'Pending', 'Not Applicable'];
const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV'];

export default function CompliancePage() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ComplianceItem | null>(null);

  const load = async () => {
    const { data } = await supabase.from('hq_compliance_items').select('*').order('due_date');
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(item => {
    if (catFilter && item.category !== catFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (stateFilter && item.state !== stateFilter) return false;
    return true;
  });

  const openModal = (item?: ComplianceItem) => {
    setEditItem(item || null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get('title') as string,
      category: fd.get('category') as string,
      status: fd.get('status') as string,
      state: fd.get('state') as string || null,
      due_date: fd.get('due_date') as string || null,
      description: fd.get('description') as string || null,
      responsible_party: fd.get('responsible_party') as string || null,
    };
    if (editItem) {
      await supabase.from('hq_compliance_items').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('hq_compliance_items').insert(payload);
    }
    toast.success(editItem ? 'Updated' : 'Created');
    setModalOpen(false);
    load();
  };

  const dotColor = (status: string) => {
    if (status === 'Compliant') return 'green';
    if (status === 'Due Soon') return 'amber';
    if (status === 'Overdue') return 'red';
    if (status === 'In Progress') return 'blue';
    return 'gray';
  };

  const badgeClass = (status: string) => {
    if (status === 'Compliant') return 'badge-compliant';
    if (status === 'Due Soon') return 'badge-due-soon';
    if (status === 'Overdue') return 'badge-overdue';
    if (status === 'In Progress') return 'badge-in-progress';
    return 'badge-pending';
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Compliance</h1>
          <p className="view-subtitle">Track regulatory and compliance requirements</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
          <Plus size={14} /> Add Item
        </button>
      </div>

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
                  <div className="compliance-title">{item.title}</div>
                  <div className="compliance-due">
                    <span className="badge badge-muted" style={{ marginRight: '0.375rem' }}>{item.category}</span>
                    {item.state && <span className="badge badge-primary" style={{ marginRight: '0.375rem' }}>{item.state}</span>}
                    {dueText}
                  </div>
                </div>
                <span className={`badge ${badgeClass(item.status)}`}>{item.status}</span>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Compliance Item' : 'New Compliance Item'}>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label className="field-label">Title</label>
            <input className="input-field" name="title" required defaultValue={editItem?.title || ''} />
          </div>
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
          <div className="form-row">
            <label className="field-label">Responsible Party</label>
            <input className="input-field" name="responsible_party" defaultValue={editItem?.responsible_party || ''} />
          </div>
          <div className="form-row">
            <label className="field-label">Description</label>
            <textarea className="input-field" name="description" defaultValue={editItem?.description || ''} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editItem ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
