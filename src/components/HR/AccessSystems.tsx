import { useState, useEffect } from 'react';
import { Monitor, Plus, Trash2, Laptop, Smartphone, Key, CreditCard, ShieldOff, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

/* ─── Types ─── */
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
  notes: string | null;
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
  notes: string | null;
}

/* ─── Constants ─── */
const SYSTEM_CATEGORIES = [
  { value: 'google_workspace', label: 'Google Workspace', systems: ['Gmail', 'Google Drive', 'Google Calendar', 'Google Meet'] },
  { value: 'atlas_v2', label: 'Atlas V2', systems: ['Atlas V2 Delivery'] },
  { value: 'atlas_hq', label: 'Atlas HQ', systems: ['Atlas HQ'] },
  { value: 'state_portal', label: 'State Portal', systems: ['Metrc PA', 'Metrc OH', 'Metrc MD', 'Metrc NJ', 'Metrc MO', 'Metrc WV'] },
  { value: 'custom', label: 'Custom', systems: [] },
];

const DEVICE_TYPES = ['Laptop', 'Phone', 'Tablet', 'Keys', 'Badge', 'Vehicle Key', 'Radio', 'Other'];
const ACCESS_LEVELS = ['admin', 'user', 'viewer'];
const RETURN_CONDITIONS = ['good', 'damaged', 'lost'];

function statusBadge(status: string) {
  if (status === 'active') return 'badge-active';
  if (status === 'suspended') return 'badge-due-soon';
  return 'badge-expired';
}

function deviceIcon(type: string) {
  if (type === 'Laptop' || type === 'Tablet') return Laptop;
  if (type === 'Phone') return Smartphone;
  if (type === 'Keys' || type === 'Vehicle Key') return Key;
  if (type === 'Badge') return CreditCard;
  return Monitor;
}

interface Props {
  employeeId: string;
}

export default function AccessSystems({ employeeId }: Props) {
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [hardware, setHardware] = useState<HardwareRecord[]>([]);
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [showHardwareForm, setShowHardwareForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);

  const loadAccess = async () => {
    const { data } = await supabase.from('hq_employee_access').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
    setAccess(data || []);
  };

  const loadHardware = async () => {
    const { data } = await supabase.from('hq_employee_hardware').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
    setHardware(data || []);
  };

  useEffect(() => { loadAccess(); loadHardware(); }, [employeeId]);

  /* ─── Access Handlers ─── */
  const handleAddAccess = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const systemName = fd.get('system_name') as string || fd.get('custom_system') as string;
    if (!systemName) { toast.error('System name is required'); return; }
    const { error } = await supabase.from('hq_employee_access').insert({
      employee_id: employeeId,
      system_name: systemName,
      system_category: fd.get('system_category') as string,
      account_username: fd.get('account_username') as string || null,
      access_level: fd.get('access_level') as string || 'user',
      granted_date: fd.get('granted_date') as string || null,
    });
    if (error) { toast.error('Failed to add access'); return; }
    toast.success('Access record added');
    setShowAccessForm(false);
    setSelectedCategory('');
    loadAccess();
  };

  const handleRevoke = async (id: string, revokedBy: string) => {
    const { error } = await supabase.from('hq_employee_access').update({
      status: 'revoked',
      revoked_date: new Date().toISOString().split('T')[0],
      revoked_by: revokedBy || 'Unknown',
    }).eq('id', id);
    if (error) { toast.error('Failed to revoke'); return; }
    toast.success('Access revoked');
    setRevokeId(null);
    loadAccess();
  };

  const handleSuspend = async (id: string) => {
    const { error } = await supabase.from('hq_employee_access').update({ status: 'suspended' }).eq('id', id);
    if (error) { toast.error('Failed to suspend'); return; }
    toast.success('Access suspended');
    loadAccess();
  };

  const handleReactivate = async (id: string) => {
    const { error } = await supabase.from('hq_employee_access').update({ status: 'active', revoked_date: null, revoked_by: null }).eq('id', id);
    if (error) { toast.error('Failed to reactivate'); return; }
    toast.success('Access reactivated');
    loadAccess();
  };

  const handleDeleteAccess = async (id: string) => {
    await supabase.from('hq_employee_access').delete().eq('id', id);
    toast.success('Removed');
    loadAccess();
  };

  /* ─── Hardware Handlers ─── */
  const handleAddHardware = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('hq_employee_hardware').insert({
      employee_id: employeeId,
      device_type: fd.get('device_type') as string,
      model_description: fd.get('model_description') as string || null,
      serial_number: fd.get('serial_number') as string || null,
      assigned_date: fd.get('assigned_date') as string || null,
    });
    if (error) { toast.error('Failed to add hardware'); return; }
    toast.success('Hardware assigned');
    setShowHardwareForm(false);
    loadHardware();
  };

  const handleReturn = async (id: string, condition: string) => {
    const { error } = await supabase.from('hq_employee_hardware').update({
      returned_date: new Date().toISOString().split('T')[0],
      condition_on_return: condition,
    }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Hardware marked as returned');
    setReturnId(null);
    loadHardware();
  };

  const handleDeleteHardware = async (id: string) => {
    await supabase.from('hq_employee_hardware').delete().eq('id', id);
    toast.success('Removed');
    loadHardware();
  };

  const categorySystems = SYSTEM_CATEGORIES.find(c => c.value === selectedCategory)?.systems || [];

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {/* ═══ System Access ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase' }}>
          <Monitor size={14} /> System Access ({access.length})
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAccessForm(!showAccessForm)}>
          <Plus size={12} /> Add
        </button>
      </div>

      {showAccessForm && (
        <form onSubmit={handleAddAccess} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
          <select className="select-field" name="system_category" required style={{ flex: '1 1 150px' }}
            value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="">Category...</option>
            {SYSTEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {selectedCategory === 'custom' ? (
            <input className="input-field" name="custom_system" placeholder="System name" required style={{ flex: '1 1 150px' }} />
          ) : (
            <select className="select-field" name="system_name" required style={{ flex: '1 1 150px' }}>
              <option value="">System...</option>
              {categorySystems.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <input className="input-field" name="account_username" placeholder="Username / email" style={{ flex: '1 1 150px' }} />
          <select className="select-field" name="access_level" style={{ flex: '0 1 100px' }}>
            {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input className="input-field" type="date" name="granted_date" style={{ flex: '0 1 130px' }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      )}

      {access.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '0.5rem 0' }}>No system access records</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
          {access.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <strong>{r.system_name}</strong>
                  <span className={`badge ${statusBadge(r.status)}`} style={{ fontSize: '0.6rem' }}>{r.status}</span>
                  <span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>{r.access_level}</span>
                </div>
                <div style={{ color: 'var(--color-tx-muted)', fontSize: '0.7rem' }}>
                  {r.account_username && <>{r.account_username} · </>}
                  Granted: {formatDate(r.granted_date)}
                  {r.revoked_date && <> · Revoked: {formatDate(r.revoked_date)} by {r.revoked_by}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                {r.status === 'active' && (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSuspend(r.id)} title="Suspend">
                      <ShieldOff size={12} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevokeId(r.id)} title="Revoke" style={{ color: 'var(--color-error)' }}>
                      <ShieldOff size={12} />
                    </button>
                  </>
                )}
                {r.status === 'suspended' && (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleReactivate(r.id)} title="Reactivate">
                      <RotateCcw size={12} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevokeId(r.id)} title="Revoke" style={{ color: 'var(--color-error)' }}>
                      <ShieldOff size={12} />
                    </button>
                  </>
                )}
                {r.status === 'revoked' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleReactivate(r.id)} title="Reactivate">
                    <RotateCcw size={12} />
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteAccess(r.id)} style={{ color: 'var(--color-error)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoke dialog */}
      {revokeId && (
        <div style={{ padding: '0.75rem', background: 'var(--color-error-hl)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleRevoke(revokeId, fd.get('revoked_by') as string); }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Revoked by:</span>
            <input className="input-field" name="revoked_by" placeholder="Your name" required style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm" style={{ background: 'var(--color-error)' }}>Confirm Revoke</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevokeId(null)}>Cancel</button>
          </form>
        </div>
      )}

      {/* ═══ Hardware ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase' }}>
          <Laptop size={14} /> Hardware ({hardware.length})
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowHardwareForm(!showHardwareForm)}>
          <Plus size={12} /> Add
        </button>
      </div>

      {showHardwareForm && (
        <form onSubmit={handleAddHardware} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
          <select className="select-field" name="device_type" required style={{ flex: '1 1 120px' }}>
            <option value="">Device type...</option>
            {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input-field" name="model_description" placeholder="Model / description" style={{ flex: '1 1 180px' }} />
          <input className="input-field" name="serial_number" placeholder="Serial number" style={{ flex: '1 1 140px' }} />
          <input className="input-field" type="date" name="assigned_date" style={{ flex: '0 1 130px' }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      )}

      {hardware.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '0.5rem 0' }}>No hardware assigned</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {hardware.map(h => {
            const Icon = deviceIcon(h.device_type);
            const isReturned = !!h.returned_date;
            return (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <Icon size={14} style={{ color: 'var(--color-tx-muted)', flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <strong>{h.device_type}</strong>
                      {h.model_description && <span style={{ color: 'var(--color-tx-muted)' }}>— {h.model_description}</span>}
                      {isReturned ? (
                        <span className="badge badge-active" style={{ fontSize: '0.6rem' }}>Returned</span>
                      ) : (
                        <span className="badge badge-due-soon" style={{ fontSize: '0.6rem' }}>Assigned</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--color-tx-muted)', fontSize: '0.7rem' }}>
                      {h.serial_number && <>SN: {h.serial_number} · </>}
                      Assigned: {formatDate(h.assigned_date)}
                      {h.returned_date && <> · Returned: {formatDate(h.returned_date)} ({h.condition_on_return})</>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  {!isReturned && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReturnId(h.id)} title="Mark returned">
                      <RotateCcw size={12} />
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteHardware(h.id)} style={{ color: 'var(--color-error)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return dialog */}
      {returnId && (
        <div style={{ padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleReturn(returnId, fd.get('condition') as string); }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Condition:</span>
            <select className="select-field" name="condition" required style={{ flex: '0 1 120px' }}>
              {RETURN_CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Confirm Return</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReturnId(null)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}
