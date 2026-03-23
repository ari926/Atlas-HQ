import { useState, useEffect, useMemo } from 'react';
import { Monitor, Laptop, AlertTriangle, Shield, Search, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

interface AccessRecord {
  id: string;
  employee_id: string;
  system_name: string;
  system_category: string;
  account_username: string | null;
  access_level: string;
  status: string;
  granted_date: string | null;
  revoked_date: string | null;
  revoked_by: string | null;
}

interface HardwareRecord {
  id: string;
  employee_id: string;
  device_type: string;
  model_description: string | null;
  serial_number: string | null;
  assigned_date: string | null;
  returned_date: string | null;
  condition_on_return: string | null;
}

interface Props {
  employees: Employee[];
}

function statusBadge(status: string) {
  if (status === 'active') return 'badge-active';
  if (status === 'suspended') return 'badge-due-soon';
  return 'badge-expired';
}

export default function ITAccessTab({ employees }: Props) {
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [hardware, setHardware] = useState<HardwareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHardware, setShowHardware] = useState(false);
  const [accessModal, setAccessModal] = useState(false);
  const [hardwareModal, setHardwareModal] = useState(false);
  const [editAccess, setEditAccess] = useState<AccessRecord | null>(null);
  const [editHardware, setEditHardware] = useState<HardwareRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'access' | 'hardware'; id: string } | null>(null);

  const loadData = async () => {
    const [accRes, hwRes] = await Promise.all([
      supabase.from('hq_employee_access').select('*').order('created_at', { ascending: false }),
      supabase.from('hq_employee_hardware').select('*').order('created_at', { ascending: false }),
    ]);
    setAccess(accRes.data || []);
    setHardware(hwRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  /* ─── CRUD handlers ─── */
  const handleSaveAccess = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      employee_id: fd.get('employee_id') as string,
      system_name: fd.get('system_name') as string,
      system_category: fd.get('system_category') as string,
      account_username: fd.get('account_username') as string || null,
      access_level: fd.get('access_level') as string,
      status: fd.get('status') as string,
      granted_date: fd.get('granted_date') as string || null,
      revoked_date: fd.get('revoked_date') as string || null,
      revoked_by: fd.get('revoked_by') as string || null,
    };
    if (editAccess) {
      const { error } = await supabase.from('hq_employee_access').update(payload).eq('id', editAccess.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Access record updated');
    } else {
      const { error } = await supabase.from('hq_employee_access').insert(payload);
      if (error) { toast.error('Failed to add: ' + error.message); return; }
      toast.success('Access record added');
    }
    setAccessModal(false);
    setEditAccess(null);
    loadData();
  };

  const handleSaveHardware = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      employee_id: fd.get('employee_id') as string,
      device_type: fd.get('device_type') as string,
      model_description: fd.get('model_description') as string || null,
      serial_number: fd.get('serial_number') as string || null,
      assigned_date: fd.get('assigned_date') as string || null,
      returned_date: fd.get('returned_date') as string || null,
      condition_on_return: fd.get('condition_on_return') as string || null,
    };
    if (editHardware) {
      const { error } = await supabase.from('hq_employee_hardware').update(payload).eq('id', editHardware.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Hardware record updated');
    } else {
      const { error } = await supabase.from('hq_employee_hardware').insert(payload);
      if (error) { toast.error('Failed to add: ' + error.message); return; }
      toast.success('Hardware record added');
    }
    setHardwareModal(false);
    setEditHardware(null);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const table = deleteConfirm.type === 'access' ? 'hq_employee_access' : 'hq_employee_hardware';
    const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Record deleted');
    setDeleteConfirm(null);
    loadData();
  };

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  const empName = (id: string) => {
    const e = empMap.get(id);
    return e ? `${e.first_name} ${e.last_name}` : 'Unknown';
  };

  /* ─── KPIs ─── */
  const activeAccess = access.filter(a => a.status === 'active').length;
  const distinctSystems = new Set(access.map(a => a.system_name)).size;
  const hardwareOut = hardware.filter(h => !h.returned_date).length;
  const pendingOffboards = useMemo(() => {
    const terminated = new Set(employees.filter(e => e.status === 'Terminated').map(e => e.id));
    return access.filter(a => a.status === 'active' && terminated.has(a.employee_id)).length;
  }, [access, employees]);

  /* ─── Filtered access ─── */
  const filteredAccess = useMemo(() => {
    return access.filter(a => {
      if (categoryFilter && a.system_category !== categoryFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (searchQuery) {
        const name = empName(a.employee_id).toLowerCase();
        const system = a.system_name.toLowerCase();
        const q = searchQuery.toLowerCase();
        if (!name.includes(q) && !system.includes(q)) return false;
      }
      return true;
    });
  }, [access, categoryFilter, statusFilter, searchQuery]);

  /* ─── Filtered hardware ─── */
  const filteredHardware = useMemo(() => {
    if (!searchQuery) return hardware;
    return hardware.filter(h => {
      const name = empName(h.employee_id).toLowerCase();
      const device = h.device_type.toLowerCase();
      const q = searchQuery.toLowerCase();
      return name.includes(q) || device.includes(q);
    });
  }, [hardware, searchQuery]);

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />;

  return (
    <div>
      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon teal"><Monitor size={20} /></div>
          <div className="kpi-label">Active Accesses</div>
          <div className="kpi-value">{activeAccess}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Shield size={20} /></div>
          <div className="kpi-label">Systems Tracked</div>
          <div className="kpi-value">{distinctSystems}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><Laptop size={20} /></div>
          <div className="kpi-label">Hardware Out</div>
          <div className="kpi-value">{hardwareOut}</div>
        </div>
        <div className="kpi-card" style={pendingOffboards > 0 ? { borderLeft: '3px solid var(--color-error)' } : undefined}>
          <div className={`kpi-icon ${pendingOffboards > 0 ? 'red' : 'green'}`}><AlertTriangle size={20} /></div>
          <div className="kpi-label">Pending Offboards</div>
          <div className="kpi-value" style={pendingOffboards > 0 ? { color: 'var(--color-error)' } : undefined}>{pendingOffboards}</div>
        </div>
      </div>

      {/* Alert banner */}
      {pendingOffboards > 0 && (
        <div style={{ padding: '0.625rem 1rem', background: 'var(--color-error-hl)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-error)' }}>
            <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            {pendingOffboards} terminated employee{pendingOffboards > 1 ? 's' : ''} still ha{pendingOffboards > 1 ? 've' : 's'} active system access
          </span>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }}
            onClick={() => { setStatusFilter('active'); setSearchQuery(''); }}>
            Review
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-tx-muted)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '2rem' }}
            placeholder="Search employees or systems..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="select-field" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          <option value="google_workspace">Google Workspace</option>
          <option value="atlas_v2">Atlas V2</option>
          <option value="atlas_hq">Atlas HQ</option>
          <option value="state_portal">State Portal</option>
          <option value="custom">Custom</option>
        </select>
        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Access Table */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <Monitor size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            System Access ({filteredAccess.length})
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditAccess(null); setAccessModal(true); }}>
            <Plus size={14} /> Add Access
          </button>
        </div>
        {filteredAccess.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '1rem 0', textAlign: 'center' }}>No access records found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>System</th>
                  <th>Username</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Granted</th>
                  <th>Revoked</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAccess.map(a => {
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{empName(a.employee_id)}</td>
                      <td>{a.system_name}</td>
                      <td style={{ color: 'var(--color-tx-muted)' }}>{a.account_username || '—'}</td>
                      <td><span className="badge badge-muted">{a.access_level}</span></td>
                      <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                      <td>{formatDate(a.granted_date)}</td>
                      <td style={{ color: a.revoked_date ? 'var(--color-error)' : undefined }}>
                        {a.revoked_date ? <>{formatDate(a.revoked_date)} <span style={{ fontSize: '0.7rem' }}>by {a.revoked_by}</span></> : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setEditAccess(a); setAccessModal(true); }}>Edit</button>
                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-error)' }} onClick={() => setDeleteConfirm({ type: 'access', id: a.id })}>
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

      {/* Hardware Section (collapsible) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="card-title"
            onClick={() => setShowHardware(!showHardware)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', padding: 0, margin: 0, fontFamily: 'var(--font-family)', color: 'var(--color-tx)' }}
          >
            <Laptop size={14} />
            Hardware Assignments ({filteredHardware.length})
            <span style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{showHardware ? '▲' : '▼'}</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditHardware(null); setHardwareModal(true); setShowHardware(true); }}>
            <Plus size={14} /> Add Hardware
          </button>
        </div>
        {showHardware && (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            {filteredHardware.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '1rem 0', textAlign: 'center' }}>No hardware records</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Device</th>
                    <th>Model</th>
                    <th>Serial</th>
                    <th>Assigned</th>
                    <th>Returned</th>
                    <th>Condition</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHardware.map(h => {
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 500 }}>{empName(h.employee_id)}</td>
                        <td>{h.device_type}</td>
                        <td style={{ color: 'var(--color-tx-muted)' }}>{h.model_description || '—'}</td>
                        <td style={{ color: 'var(--color-tx-muted)' }}>{h.serial_number || '—'}</td>
                        <td>{formatDate(h.assigned_date)}</td>
                        <td style={{ color: h.returned_date ? 'var(--color-success)' : 'var(--color-warning)' }}>
                          {h.returned_date ? formatDate(h.returned_date) : 'Outstanding'}
                        </td>
                        <td>{h.condition_on_return ? <span className="badge badge-muted">{h.condition_on_return}</span> : '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => { setEditHardware(h); setHardwareModal(true); setShowHardware(true); }}>Edit</button>
                          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-error)' }} onClick={() => setDeleteConfirm({ type: 'hardware', id: h.id })}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ─── Access Modal ─── */}
      <Modal open={accessModal} onClose={() => { setAccessModal(false); setEditAccess(null); }} title={editAccess ? 'Edit System Access' : 'Add System Access'}>
        <form onSubmit={handleSaveAccess}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-row">
              <label className="field-label">Employee *</label>
              <select className="select-field" name="employee_id" defaultValue={editAccess?.employee_id || ''} required>
                <option value="">Select employee...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">System Name *</label>
              <input className="input-field" name="system_name" defaultValue={editAccess?.system_name || ''} required placeholder="e.g. Google Workspace" />
            </div>
            <div className="form-row">
              <label className="field-label">Category</label>
              <select className="select-field" name="system_category" defaultValue={editAccess?.system_category || 'custom'}>
                <option value="google_workspace">Google Workspace</option>
                <option value="atlas_v2">Atlas V2</option>
                <option value="atlas_hq">Atlas HQ</option>
                <option value="state_portal">State Portal</option>
                <option value="fleet_management">Fleet Management</option>
                <option value="financial">Financial / Banking</option>
                <option value="communication">Communication</option>
                <option value="custom">Other / Custom</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Username / Email</label>
              <input className="input-field" name="account_username" defaultValue={editAccess?.account_username || ''} placeholder="Login username or email" />
            </div>
            <div className="form-row">
              <label className="field-label">Access Level *</label>
              <select className="select-field" name="access_level" defaultValue={editAccess?.access_level || 'user'} required>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
                <option value="viewer">Viewer</option>
                <option value="billing">Billing</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Status *</label>
              <select className="select-field" name="status" defaultValue={editAccess?.status || 'active'} required>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Granted Date</label>
              <input className="input-field" name="granted_date" type="date" defaultValue={editAccess?.granted_date || new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-row">
              <label className="field-label">Revoked Date</label>
              <input className="input-field" name="revoked_date" type="date" defaultValue={editAccess?.revoked_date || ''} />
            </div>
            <div className="form-row" style={{ gridColumn: 'span 2' }}>
              <label className="field-label">Revoked By</label>
              <input className="input-field" name="revoked_by" defaultValue={editAccess?.revoked_by || ''} placeholder="Name of person who revoked" />
            </div>
          </div>
          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setAccessModal(false); setEditAccess(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editAccess ? 'Save Changes' : 'Add Access'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Hardware Modal ─── */}
      <Modal open={hardwareModal} onClose={() => { setHardwareModal(false); setEditHardware(null); }} title={editHardware ? 'Edit Hardware Assignment' : 'Add Hardware Assignment'}>
        <form onSubmit={handleSaveHardware}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-row">
              <label className="field-label">Employee *</label>
              <select className="select-field" name="employee_id" defaultValue={editHardware?.employee_id || ''} required>
                <option value="">Select employee...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Device Type *</label>
              <select className="select-field" name="device_type" defaultValue={editHardware?.device_type || ''} required>
                <option value="">Select type...</option>
                <option value="Laptop">Laptop</option>
                <option value="Desktop">Desktop</option>
                <option value="Phone">Phone</option>
                <option value="Tablet">Tablet</option>
                <option value="Monitor">Monitor</option>
                <option value="Printer">Printer</option>
                <option value="Scanner">Scanner</option>
                <option value="Hotspot">Hotspot</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-row">
              <label className="field-label">Model / Description</label>
              <input className="input-field" name="model_description" defaultValue={editHardware?.model_description || ''} placeholder="e.g. MacBook Air M2" />
            </div>
            <div className="form-row">
              <label className="field-label">Serial / Asset #</label>
              <input className="input-field" name="serial_number" defaultValue={editHardware?.serial_number || ''} placeholder="Serial number or asset tag" />
            </div>
            <div className="form-row">
              <label className="field-label">Assigned Date</label>
              <input className="input-field" name="assigned_date" type="date" defaultValue={editHardware?.assigned_date || new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-row">
              <label className="field-label">Returned Date</label>
              <input className="input-field" name="returned_date" type="date" defaultValue={editHardware?.returned_date || ''} />
            </div>
            <div className="form-row" style={{ gridColumn: 'span 2' }}>
              <label className="field-label">Condition on Return</label>
              <select className="select-field" name="condition_on_return" defaultValue={editHardware?.condition_on_return || ''}>
                <option value="">Not returned yet</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Damaged">Damaged</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>
          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setHardwareModal(false); setEditHardware(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editHardware ? 'Save Changes' : 'Add Hardware'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.type === 'access' ? 'Access' : 'Hardware'} Record`}
        message="This action cannot be undone. Are you sure?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
