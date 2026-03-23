import { useState, useEffect, useMemo } from 'react';
import { Monitor, Laptop, AlertTriangle, Shield, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

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
  onOpenEmployee: (emp: Employee) => void;
}

function statusBadge(status: string) {
  if (status === 'active') return 'badge-active';
  if (status === 'suspended') return 'badge-due-soon';
  return 'badge-expired';
}

export default function ITAccessTab({ employees, onOpenEmployee }: Props) {
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [hardware, setHardware] = useState<HardwareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHardware, setShowHardware] = useState(false);

  useEffect(() => {
    async function load() {
      const [accRes, hwRes] = await Promise.all([
        supabase.from('hq_employee_access').select('*').order('created_at', { ascending: false }),
        supabase.from('hq_employee_hardware').select('*').order('created_at', { ascending: false }),
      ]);
      setAccess(accRes.data || []);
      setHardware(hwRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

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
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>
          <Monitor size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
          System Access ({filteredAccess.length})
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
                </tr>
              </thead>
              <tbody>
                {filteredAccess.map(a => {
                  const emp = empMap.get(a.employee_id);
                  return (
                    <tr key={a.id} style={{ cursor: emp ? 'pointer' : undefined }} onClick={() => emp && onOpenEmployee(emp)}>
                      <td style={{ fontWeight: 500 }}>{empName(a.employee_id)}</td>
                      <td>{a.system_name}</td>
                      <td style={{ color: 'var(--color-tx-muted)' }}>{a.account_username || '—'}</td>
                      <td><span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>{a.access_level}</span></td>
                      <td><span className={`badge ${statusBadge(a.status)}`} style={{ fontSize: '0.6rem' }}>{a.status}</span></td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{formatDate(a.granted_date)}</td>
                      <td style={{ fontSize: '0.7rem', color: a.revoked_date ? 'var(--color-error)' : 'var(--color-tx-muted)' }}>
                        {a.revoked_date ? <>{formatDate(a.revoked_date)} <span style={{ fontSize: '0.6rem' }}>by {a.revoked_by}</span></> : '—'}
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
        <button
          type="button"
          className="card-title"
          onClick={() => setShowHardware(!showHardware)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', width: '100%', background: 'none', border: 'none', padding: 0, margin: 0, fontFamily: 'var(--font-family)', color: 'var(--color-tx)' }}
        >
          <Laptop size={14} />
          Hardware Assignments ({filteredHardware.length})
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{showHardware ? '▲' : '▼'}</span>
        </button>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredHardware.map(h => {
                    const emp = empMap.get(h.employee_id);
                    return (
                      <tr key={h.id} style={{ cursor: emp ? 'pointer' : undefined }} onClick={() => emp && onOpenEmployee(emp)}>
                        <td style={{ fontWeight: 500 }}>{empName(h.employee_id)}</td>
                        <td>{h.device_type}</td>
                        <td style={{ color: 'var(--color-tx-muted)' }}>{h.model_description || '—'}</td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{h.serial_number || '—'}</td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>{formatDate(h.assigned_date)}</td>
                        <td style={{ fontSize: '0.7rem', color: h.returned_date ? 'var(--color-success)' : 'var(--color-warning)' }}>
                          {h.returned_date ? formatDate(h.returned_date) : 'Outstanding'}
                        </td>
                        <td>{h.condition_on_return ? <span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>{h.condition_on_return}</span> : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
