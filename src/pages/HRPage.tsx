import { useEffect, useState, useMemo } from 'react';
import { Users, Plus, Trash2, Shield, FlaskConical, AlertTriangle, ExternalLink, Phone, User, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil } from '../lib/utils';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import TrainingRecords from '../components/HR/TrainingRecords';
import OnboardingChecklist from '../components/HR/OnboardingChecklist';
import toast from 'react-hot-toast';

/* ─── Types ─── */
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
  notes: string | null;
  document_url: string | null;
  // Cannabis credentials
  bg_check_status: string | null;
  bg_check_expiry: string | null;
  cannabis_permit_number: string | null;
  cannabis_permit_state: string | null;
  drug_test_status: string | null;
  drug_test_last: string | null;
  drug_test_next: string | null;
  medical_card_expiry: string | null;
  // Emergency contact
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  // Compensation
  pay_rate: number | null;
  pay_type: string | null;
  // Vehicle
  assigned_vehicle: string | null;
}

interface Driver {
  id: string;
  display_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role_type: string | null;
  is_active: boolean;
  status: string;
  license_number: string | null;
  oln_state: string | null;
  oln_expiration: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  date_hired: string | null;
  date_terminated: string | null;
  pay_rate: number | null;
  prior_background: string | null;
  dob: string | null;
  notes: string | null;
  inactive_reason: string | null;
}

/* ─── Constants ─── */
const DEPARTMENTS = [
  'Operations / Dispatch', 'Drivers', 'Compliance / Legal',
  'Finance / Admin', 'Warehouse / Logistics', 'Management',
  'Operations', 'Compliance', 'Executive', 'Other',
];

const BG_STATUSES = ['passed', 'pending', 'expired', 'not_started'];
const DRUG_STATUSES = ['passed', 'pending', 'failed', 'not_scheduled'];
const PAY_TYPES = ['hourly', 'salary', 'contract'];
const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV', 'UT', 'NV'];

/* ─── Helpers ─── */
function credBadge(status: string | null): { cls: string; text: string } {
  if (!status) return { cls: 'badge-pending', text: 'N/A' };
  if (status === 'passed') return { cls: 'badge-active', text: 'Passed' };
  if (status === 'pending') return { cls: 'badge-due-soon', text: 'Pending' };
  if (status === 'expired' || status === 'failed') return { cls: 'badge-expired', text: status.charAt(0).toUpperCase() + status.slice(1) };
  return { cls: 'badge-pending', text: status };
}

/* ═══════════════════════════════════════════
   HR PAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function HRPage() {
  const [tab, setTab] = useState<'staff' | 'drivers'>('staff');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [driverModal, setDriverModal] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showKpis, setShowKpis] = useState(true);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showComp, setShowComp] = useState(false);

  const loadEmployees = async () => {
    const { data, error } = await supabase.from('hq_employees').select('*').order('last_name');
    if (error) toast.error('Failed to load employees');
    setEmployees(data || []);
  };

  const loadDrivers = async () => {
    const { data } = await supabase.from('drivers')
      .select('*')
      .order('last_name');
    setDrivers(data || []);
  };

  const openDriverModal = (d?: Driver) => { setEditDriver(d || null); setDriverModal(true); };

  const handleDriverSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      email: fd.get('email') as string || null,
      phone: fd.get('phone') as string || null,
      role_type: fd.get('role_type') as string || null,
      status: fd.get('status') as string || 'active',
      is_active: (fd.get('status') as string) !== 'terminated',
      license_number: fd.get('license_number') as string || null,
      oln_state: fd.get('oln_state') as string || null,
      oln_expiration: fd.get('oln_expiration') as string || null,
      vehicle_type: fd.get('vehicle_type') as string || null,
      vehicle_plate: fd.get('vehicle_plate') as string || null,
      date_hired: fd.get('date_hired') as string || null,
      pay_rate: parseFloat(fd.get('pay_rate') as string) || null,
      prior_background: fd.get('prior_background') as string || null,
      notes: fd.get('notes') as string || null,
      display_id: fd.get('display_id') as string || null,
    };
    if (editDriver) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', editDriver.id);
      if (error) { toast.error('Failed to update driver'); return; }
      toast.success('Driver updated');
    } else {
      const { error } = await supabase.from('drivers').insert(payload);
      if (error) { toast.error('Failed to create driver'); return; }
      toast.success('Driver created');
    }
    setDriverModal(false);
    loadDrivers();
  };

  useEffect(() => {
    Promise.all([loadEmployees(), loadDrivers()]).then(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (deptFilter && e.department !== deptFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [employees, deptFilter, statusFilter]);

  const openModal = (emp?: Employee) => {
    setEditEmp(emp || null);
    setShowCredentials(!!(emp?.bg_check_status || emp?.drug_test_status || emp?.cannabis_permit_number));
    setShowEmergency(!!(emp?.emergency_name));
    setShowComp(!!(emp?.pay_rate));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      email: fd.get('email') as string || null,
      phone: fd.get('phone') as string || null,
      department: fd.get('department') as string || null,
      role: fd.get('role') as string || null,
      status: fd.get('status') as string,
      hire_date: fd.get('hire_date') as string || null,
      notes: fd.get('notes') as string || null,
      document_url: fd.get('document_url') as string || null,
      assigned_vehicle: fd.get('assigned_vehicle') as string || null,
      // Credentials
      bg_check_status: fd.get('bg_check_status') as string || null,
      bg_check_expiry: fd.get('bg_check_expiry') as string || null,
      cannabis_permit_number: fd.get('cannabis_permit_number') as string || null,
      cannabis_permit_state: fd.get('cannabis_permit_state') as string || null,
      drug_test_status: fd.get('drug_test_status') as string || null,
      drug_test_last: fd.get('drug_test_last') as string || null,
      drug_test_next: fd.get('drug_test_next') as string || null,
      medical_card_expiry: fd.get('medical_card_expiry') as string || null,
      // Emergency
      emergency_name: fd.get('emergency_name') as string || null,
      emergency_phone: fd.get('emergency_phone') as string || null,
      emergency_relation: fd.get('emergency_relation') as string || null,
      // Compensation
      pay_rate: parseFloat(fd.get('pay_rate') as string) || null,
      pay_type: fd.get('pay_type') as string || null,
    };

    if (editEmp) {
      const { error } = await supabase.from('hq_employees').update(payload).eq('id', editEmp.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Updated');
    } else {
      const { error } = await supabase.from('hq_employees').insert(payload);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Created');
    }
    setModalOpen(false);
    loadEmployees();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('hq_employees').delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    setDeleteConfirm(null);
    setModalOpen(false);
    setEditEmp(null);
    loadEmployees();
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;

  const activeDrivers = drivers.filter(d => d.is_active !== false);
  const inactiveDrivers = drivers.filter(d => d.is_active === false);

  // KPI stats
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const bgExpiring = employees.filter(e => { const d = daysUntil(e.bg_check_expiry); return d !== null && d >= 0 && d <= 30; }).length;
  const drugPending = employees.filter(e => e.drug_test_status === 'pending').length;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Human Resources</h1>
          <p className="view-subtitle">Cannabis workforce management — {employees.length} employees, {drivers.length} drivers</p>
        </div>
        {tab === 'staff' && (
          <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
            <Plus size={14} /> Add Employee
          </button>
        )}
      </div>

      {/* KPI Cards (collapsible) */}
      <button
        type="button"
        onClick={() => setShowKpis(!showKpis)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx-muted)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0', marginBottom: showKpis ? '0.5rem' : '1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}
      >
        {showKpis ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Workforce Summary
      </button>
      {showKpis && (
      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon teal"><Users size={20} /></div>
          <div className="kpi-label">Active Employees</div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-delta">{employees.length} total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><Shield size={20} /></div>
          <div className="kpi-label">BG Checks Expiring</div>
          <div className="kpi-value">{bgExpiring}</div>
          <div className="kpi-delta">within 30 days</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><FlaskConical size={20} /></div>
          <div className="kpi-label">Drug Tests Pending</div>
          <div className="kpi-value">{drugPending}</div>
          <div className="kpi-delta">awaiting results</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Users size={20} /></div>
          <div className="kpi-label">Active Drivers</div>
          <div className="kpi-value">{activeDrivers.length}</div>
          <div className="kpi-delta">{inactiveDrivers.length} inactive</div>
        </div>
      </div>
      )}

      {/* Tabs */}
      <div className="tab-list">
        <button className={`tab-btn${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
          All Staff ({employees.length})
        </button>
        <button className={`tab-btn${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
          Drivers ({drivers.length})
        </button>
      </div>

      {/* Staff Tab */}
      {tab === 'staff' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select className="select-field" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 130 }}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
            {(deptFilter || statusFilter) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setDeptFilter(''); setStatusFilter(''); }}>Clear</button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={48} strokeWidth={1} />
              <div className="empty-state-title">No employees</div>
              <div className="empty-state-text">Add your first employee to start building the directory.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th>
                  <th>BG Check</th><th>Drug Test</th><th>Hire Date</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(e => {
                    const statusCls = e.status === 'Active' ? 'badge-active' : e.status === 'On Leave' ? 'badge-due-soon' : 'badge-error';
                    const bg = credBadge(e.bg_check_status);
                    const dt = credBadge(e.drug_test_status);
                    return (
                      <tr key={e.id}>
                        <td><strong>{e.first_name} {e.last_name}</strong></td>
                        <td style={{ fontSize: '0.75rem' }}>{e.email || '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{e.department || '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{e.role || '—'}</td>
                        <td><span className={`badge ${statusCls}`}>{e.status}</span></td>
                        <td><span className={`badge ${bg.cls}`} style={{ fontSize: '0.65rem' }}>{bg.text}</span></td>
                        <td><span className={`badge ${dt.cls}`} style={{ fontSize: '0.65rem' }}>{dt.text}</span></td>
                        <td style={{ fontSize: '0.75rem' }}>{formatDate(e.hire_date)}</td>
                        <td><button className="btn btn-sm btn-ghost" onClick={() => openModal(e)}>Edit</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Drivers Tab */}
      {tab === 'drivers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', margin: 0 }}>
              Synced with Atlas V2 — changes here reflect in both apps. {activeDrivers.length} active, {inactiveDrivers.length} inactive.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openDriverModal()}>
              <Plus size={14} /> Add Driver
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th>
                <th>License</th><th>Vehicle</th><th>Hired</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {[...activeDrivers, ...inactiveDrivers].map(d => {
                  const olnDays = daysUntil(d.oln_expiration);
                  const olnBadge = olnDays === null ? null : olnDays < 0 ? 'badge-expired' : olnDays <= 30 ? 'badge-due-soon' : null;
                  return (
                    <tr key={d.id} style={!d.is_active ? { opacity: 0.5 } : undefined}>
                      <td style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{d.display_id || '—'}</td>
                      <td><strong>{d.first_name} {d.last_name}</strong></td>
                      <td style={{ fontSize: '0.75rem' }}>{d.email || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{d.phone || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{d.role_type || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {d.license_number || '—'}
                        {olnBadge && <span className={`badge ${olnBadge}`} style={{ fontSize: '0.6rem', marginLeft: 4 }}>{olnDays! < 0 ? 'Exp' : `${olnDays}d`}</span>}
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>{d.vehicle_type ? `${d.vehicle_type}${d.vehicle_plate ? ` (${d.vehicle_plate})` : ''}` : '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{formatDate(d.date_hired)}</td>
                      <td><span className={`badge ${d.is_active ? 'badge-active' : 'badge-error'}`}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => openDriverModal(d)}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Employee Modal ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmp ? `${editEmp.first_name} ${editEmp.last_name}` : 'New Employee'} wide>
        <form onSubmit={handleSave}>
          {/* Basic Info */}
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
              <select className="select-field" name="department" defaultValue={editEmp?.department || ''}>
                <option value="">—</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
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
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Hire Date</label>
              <input className="input-field" type="date" name="hire_date" defaultValue={editEmp?.hire_date || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Assigned Vehicle</label>
              <input className="input-field" name="assigned_vehicle" defaultValue={editEmp?.assigned_vehicle || ''} placeholder="e.g., Van #3 — 2023 Transit" />
            </div>
            <div className="form-row">
              <label className="field-label">Document Link</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input className="input-field" name="document_url" defaultValue={editEmp?.document_url || ''} placeholder="Google Drive URL" style={{ flex: 1 }} />
                {editEmp?.document_url && (
                  <a href={editEmp.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={14} /></a>
                )}
              </div>
            </div>
          </div>

          {/* ─── Cannabis Credentials (collapsible) ─── */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCredentials(!showCredentials)}
              style={{ color: 'var(--color-tx-muted)', marginBottom: showCredentials ? '0.5rem' : 0 }}>
              <Shield size={14} /> {showCredentials ? 'Hide' : 'Show'} Cannabis Credentials
            </button>
            {showCredentials && (
              <>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="field-label">Background Check Status</label>
                    <select className="select-field" name="bg_check_status" defaultValue={editEmp?.bg_check_status || ''}>
                      <option value="">—</option>
                      {BG_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="field-label">BG Check Expiry</label>
                    <input className="input-field" type="date" name="bg_check_expiry" defaultValue={editEmp?.bg_check_expiry || ''} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="field-label">Cannabis Permit #</label>
                    <input className="input-field" name="cannabis_permit_number" defaultValue={editEmp?.cannabis_permit_number || ''} />
                  </div>
                  <div className="form-row">
                    <label className="field-label">Permit State</label>
                    <select className="select-field" name="cannabis_permit_state" defaultValue={editEmp?.cannabis_permit_state || ''}>
                      <option value="">—</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="field-label">Drug Test Status</label>
                    <select className="select-field" name="drug_test_status" defaultValue={editEmp?.drug_test_status || ''}>
                      <option value="">—</option>
                      {DRUG_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="field-label">Last Drug Test</label>
                    <input className="input-field" type="date" name="drug_test_last" defaultValue={editEmp?.drug_test_last || ''} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="field-label">Next Drug Test</label>
                    <input className="input-field" type="date" name="drug_test_next" defaultValue={editEmp?.drug_test_next || ''} />
                  </div>
                  <div className="form-row">
                    <label className="field-label">Medical Card Expiry</label>
                    <input className="input-field" type="date" name="medical_card_expiry" defaultValue={editEmp?.medical_card_expiry || ''} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── Emergency Contact (collapsible) ─── */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEmergency(!showEmergency)}
              style={{ color: 'var(--color-tx-muted)', marginBottom: showEmergency ? '0.5rem' : 0 }}>
              <Phone size={14} /> {showEmergency ? 'Hide' : 'Show'} Emergency Contact
            </button>
            {showEmergency && (
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-row">
                  <label className="field-label"><User size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Name</label>
                  <input className="input-field" name="emergency_name" defaultValue={editEmp?.emergency_name || ''} />
                </div>
                <div className="form-row">
                  <label className="field-label"><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Phone</label>
                  <input className="input-field" name="emergency_phone" defaultValue={editEmp?.emergency_phone || ''} />
                </div>
                <div className="form-row">
                  <label className="field-label">Relation</label>
                  <input className="input-field" name="emergency_relation" defaultValue={editEmp?.emergency_relation || ''} placeholder="e.g., Spouse" />
                </div>
              </div>
            )}
          </div>

          {/* ─── Compensation (collapsible) ─── */}
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowComp(!showComp)}
              style={{ color: 'var(--color-tx-muted)', marginBottom: showComp ? '0.5rem' : 0 }}>
              <AlertTriangle size={14} /> {showComp ? 'Hide' : 'Show'} Compensation
            </button>
            {showComp && (
              <div className="form-grid">
                <div className="form-row">
                  <label className="field-label">Pay Rate</label>
                  <input className="input-field" type="number" step="0.01" name="pay_rate" defaultValue={editEmp?.pay_rate || ''} placeholder="$0.00" />
                </div>
                <div className="form-row">
                  <label className="field-label">Pay Type</label>
                  <select className="select-field" name="pay_type" defaultValue={editEmp?.pay_type || ''}>
                    <option value="">—</option>
                    {PAY_TYPES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <label className="field-label">Notes</label>
            <textarea className="input-field" name="notes" rows={2} defaultValue={editEmp?.notes || ''} />
          </div>

          {/* Training Records (existing employees only) */}
          {editEmp && <TrainingRecords employeeId={editEmp.id} />}

          {/* Onboarding Checklist (existing employees only) */}
          {editEmp && <OnboardingChecklist employeeId={editEmp.id} />}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
            {editEmp && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', color: 'var(--color-error)' }} onClick={() => setDeleteConfirm(editEmp)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editEmp ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Driver Modal ─── */}
      <Modal open={driverModal} onClose={() => setDriverModal(false)} title={editDriver ? `${editDriver.first_name} ${editDriver.last_name}` : 'New Driver'} wide>
        <form onSubmit={handleDriverSave}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>
            <Truck size={14} /> Changes sync to Atlas V2 in real-time
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">First Name</label>
              <input className="input-field" name="first_name" required defaultValue={editDriver?.first_name || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Last Name</label>
              <input className="input-field" name="last_name" required defaultValue={editDriver?.last_name || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Email</label>
              <input className="input-field" type="email" name="email" defaultValue={editDriver?.email || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Phone</label>
              <input className="input-field" name="phone" defaultValue={editDriver?.phone || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Display ID</label>
              <input className="input-field" name="display_id" defaultValue={editDriver?.display_id || ''} placeholder="e.g., DRV-001" />
            </div>
            <div className="form-row">
              <label className="field-label">Role Type</label>
              <input className="input-field" name="role_type" defaultValue={editDriver?.role_type || ''} placeholder="e.g., Driver, Lead Driver" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Driver License #</label>
              <input className="input-field" name="license_number" defaultValue={editDriver?.license_number || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">OLN State</label>
              <select className="select-field" name="oln_state" defaultValue={editDriver?.oln_state || ''}>
                <option value="">—</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">OLN Expiration</label>
              <input className="input-field" type="date" name="oln_expiration" defaultValue={editDriver?.oln_expiration || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Date Hired</label>
              <input className="input-field" type="date" name="date_hired" defaultValue={editDriver?.date_hired || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Vehicle Type</label>
              <input className="input-field" name="vehicle_type" defaultValue={editDriver?.vehicle_type || ''} placeholder="e.g., 2023 Ford Transit" />
            </div>
            <div className="form-row">
              <label className="field-label">Vehicle Plate</label>
              <input className="input-field" name="vehicle_plate" defaultValue={editDriver?.vehicle_plate || ''} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="field-label">Pay Rate</label>
              <input className="input-field" type="number" step="0.01" name="pay_rate" defaultValue={editDriver?.pay_rate || ''} />
            </div>
            <div className="form-row">
              <label className="field-label">Status</label>
              <select className="select-field" name="status" defaultValue={editDriver?.status || 'active'}>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="field-label">Prior Background</label>
            <input className="input-field" name="prior_background" defaultValue={editDriver?.prior_background || ''} placeholder="Previous employer / experience" />
          </div>
          <div className="form-row">
            <label className="field-label">Notes</label>
            <textarea className="input-field" name="notes" rows={2} defaultValue={editDriver?.notes || ''} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setDriverModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editDriver ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Employee"
        message={`Are you sure you want to delete ${deleteConfirm?.first_name} ${deleteConfirm?.last_name}? This will also remove all training records and onboarding tasks.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
