import { useEffect, useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  role: string | null;
  status: string;
  hire_date: string | null;
}

interface Driver {
  id: string;
  display_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean;
}

export default function HRPage() {
  const [tab, setTab] = useState<'staff' | 'drivers'>('staff');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);

  const loadEmployees = async () => {
    const { data } = await supabase.from('hq_employees').select('*').order('last_name');
    setEmployees(data || []);
  };

  const loadDrivers = async () => {
    const { data } = await supabase.from('drivers')
      .select('id, display_id, first_name, last_name, email, phone, role, is_active')
      .order('last_name');
    setDrivers(data || []);
  };

  useEffect(() => {
    Promise.all([loadEmployees(), loadDrivers()]).then(() => setLoading(false));
  }, []);

  const openModal = (emp?: Employee) => { setEditEmp(emp || null); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      email: fd.get('email') as string || null,
      phone: fd.get('phone') as string || null,
      department: fd.get('department') as string || null,
      role: fd.get('role') as string || null,
      status: fd.get('status') as string,
      hire_date: fd.get('hire_date') as string || null,
    };
    if (editEmp) {
      await supabase.from('hq_employees').update(payload).eq('id', editEmp.id);
    } else {
      await supabase.from('hq_employees').insert(payload);
    }
    toast.success(editEmp ? 'Updated' : 'Created');
    setModalOpen(false);
    loadEmployees();
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  const activeDrivers = drivers.filter(d => d.is_active !== false);
  const inactiveDrivers = drivers.filter(d => d.is_active === false);

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Human Resources</h1>
          <p className="view-subtitle">Employee directory and driver reference</p>
        </div>
        {tab === 'staff' && (
          <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
            <Plus size={14} /> Add Employee
          </button>
        )}
      </div>

      <div className="tab-list">
        <button className={`tab-btn${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
          All Staff ({employees.length})
        </button>
        <button className={`tab-btn${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
          Drivers ({drivers.length})
        </button>
      </div>

      {tab === 'staff' && (
        employees.length === 0 ? (
          <div className="empty-state">
            <Users size={48} strokeWidth={1} />
            <div className="empty-state-title">No employees</div>
            <div className="empty-state-text">Add your first employee to start building the directory.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Department</th><th>Role</th><th>Status</th><th>Hire Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {employees.map(e => {
                  const cls = e.status === 'Active' ? 'badge-active' : e.status === 'On Leave' ? 'badge-due-soon' : 'badge-error';
                  return (
                    <tr key={e.id}>
                      <td><strong>{e.first_name} {e.last_name}</strong></td>
                      <td>{e.email || '—'}</td>
                      <td>{e.phone || '—'}</td>
                      <td>{e.department || '—'}</td>
                      <td>{e.role || '—'}</td>
                      <td><span className={`badge ${cls}`}>{e.status}</span></td>
                      <td>{formatDate(e.hire_date)}</td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => openModal(e)}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'drivers' && (
        <>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', marginBottom: '1rem' }}>
            Drivers are managed in Atlas V2. This is a read-only view. {activeDrivers.length} active, {inactiveDrivers.length} inactive.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {activeDrivers.map(d => (
                  <tr key={d.id}>
                    <td>{d.display_id || '—'}</td>
                    <td>{d.first_name} {d.last_name}</td>
                    <td>{d.email || '—'}</td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.role || '—'}</td>
                    <td><span className="badge badge-active">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmp ? 'Edit Employee' : 'New Employee'}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">First Name</label>
              <input className="input-field" name="first_name" required defaultValue={editEmp?.first_name || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Last Name</label>
              <input className="input-field" name="last_name" required defaultValue={editEmp?.last_name || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Email</label>
              <input className="input-field" type="email" name="email" defaultValue={editEmp?.email || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Phone</label>
              <input className="input-field" name="phone" defaultValue={editEmp?.phone || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Department</label>
              <input className="input-field" name="department" defaultValue={editEmp?.department || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Role</label>
              <input className="input-field" name="role" defaultValue={editEmp?.role || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Status</label>
              <select className="select-field" name="status" defaultValue={editEmp?.status || 'Active'}>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Hire Date</label>
              <input className="input-field" type="date" name="hire_date" defaultValue={editEmp?.hire_date || ''} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editEmp ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
