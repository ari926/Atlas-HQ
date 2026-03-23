import { useState, useEffect, useMemo } from 'react';
import { Download, Copy, CheckCircle, AlertTriangle, Monitor, Laptop } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import Modal from '../common/Modal';
import toast from 'react-hot-toast';

interface Props {
  employeeId: string;
  employeeName: string;
  employeeDepartment?: string | null;
  employeeRole?: string | null;
  employeeHireDate?: string | null;
  onClose: () => void;
}

interface AccessRecord {
  id: string;
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
  device_type: string;
  model_description: string | null;
  serial_number: string | null;
  assigned_date: string | null;
  returned_date: string | null;
  condition_on_return: string | null;
}

export default function OffboardingReport({ employeeId, employeeName, employeeDepartment, employeeRole, employeeHireDate, onClose }: Props) {
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [hardware, setHardware] = useState<HardwareRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [accRes, hwRes] = await Promise.all([
        supabase.from('hq_employee_access').select('*').eq('employee_id', employeeId).order('revoked_date', { ascending: false }),
        supabase.from('hq_employee_hardware').select('*').eq('employee_id', employeeId).order('returned_date', { ascending: false }),
      ]);
      setAccess(accRes.data || []);
      setHardware(hwRes.data || []);
      setLoading(false);
    }
    load();
  }, [employeeId]);

  const accessRevoked = access.filter(a => a.status === 'revoked').length;
  const accessTotal = access.length;
  const hwReturned = hardware.filter(h => !!h.returned_date).length;
  const hwTotal = hardware.length;
  const isComplete = accessTotal > 0 && accessRevoked === accessTotal && hwTotal > 0 && hwReturned === hwTotal;
  const isEmpty = accessTotal === 0 && hwTotal === 0;

  const overallPct = useMemo(() => {
    const total = accessTotal + hwTotal;
    if (total === 0) return 100;
    return Math.round(((accessRevoked + hwReturned) / total) * 100);
  }, [accessRevoked, accessTotal, hwReturned, hwTotal]);

  const generateText = () => {
    const now = new Date().toLocaleDateString();
    const lines = [
      'OFFBOARDING REPORT — Talaria Transportation LLC',
      `Generated: ${now}`,
      '================================================',
      `Employee: ${employeeName}`,
      employeeDepartment ? `Department: ${employeeDepartment}` : null,
      employeeRole ? `Role: ${employeeRole}` : null,
      employeeHireDate ? `Hire Date: ${formatDate(employeeHireDate)}` : null,
      '',
      'SYSTEM ACCESS REVOCATION',
      '─────────────────────────',
      ...access.map(a => {
        const tag = a.status === 'revoked' ? 'REVOKED' : a.status === 'suspended' ? 'SUSPENDED' : 'PENDING';
        const details = a.status === 'revoked'
          ? ` — Revoked: ${formatDate(a.revoked_date)} by ${a.revoked_by}`
          : ' — Still active!';
        return `[${tag}] ${a.system_name}${a.account_username ? ` (${a.account_username})` : ''}${details}`;
      }),
      access.length === 0 ? '  No system access records' : null,
      '',
      'HARDWARE RETURNS',
      '─────────────────',
      ...hardware.map(h => {
        const tag = h.returned_date ? 'RETURNED' : 'NOT RETURNED';
        const details = h.returned_date
          ? ` — Returned: ${formatDate(h.returned_date)}, ${h.condition_on_return || 'condition unknown'}`
          : '';
        return `[${tag}] ${h.device_type}${h.model_description ? ` — ${h.model_description}` : ''}${h.serial_number ? `, SN: ${h.serial_number}` : ''}${details}`;
      }),
      hardware.length === 0 ? '  No hardware records' : null,
      '',
      'SUMMARY',
      '───────',
      `Access: ${accessRevoked} of ${accessTotal} revoked (${accessTotal > 0 ? Math.round((accessRevoked / accessTotal) * 100) : 100}%)`,
      `Hardware: ${hwReturned} of ${hwTotal} returned (${hwTotal > 0 ? Math.round((hwReturned / hwTotal) * 100) : 100}%)`,
      `Status: ${isComplete || isEmpty ? 'COMPLETE' : 'INCOMPLETE'}`,
    ].filter(l => l !== null).join('\n');
    return lines;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateText());
    toast.success('Offboarding report copied to clipboard');
  };

  const handleDownload = () => {
    const text = generateText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offboarding-${employeeName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  const scoreColor = overallPct >= 100 ? 'var(--color-success)' : overallPct >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <Modal open onClose={onClose} title={`Offboarding Report — ${employeeName}`} wide>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-tx-muted)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{overallPct}%</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Complete</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {employeeDepartment && <span style={{ color: 'var(--color-tx-muted)' }}>{employeeDepartment}</span>}
                {employeeRole && <span style={{ color: 'var(--color-tx-muted)' }}> · {employeeRole}</span>}
                {employeeHireDate && <span style={{ color: 'var(--color-tx-muted)' }}> · Hired {formatDate(employeeHireDate)}</span>}
              </div>
              {/* Progress bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', minWidth: 60 }}>Access</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--color-surface)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${accessTotal > 0 ? (accessRevoked / accessTotal) * 100 : 100}%`, height: '100%', background: accessRevoked === accessTotal ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', minWidth: 40 }}>{accessRevoked}/{accessTotal}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', minWidth: 60 }}>Hardware</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--color-surface)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${hwTotal > 0 ? (hwReturned / hwTotal) * 100 : 100}%`, height: '100%', background: hwReturned === hwTotal ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', minWidth: 40 }}>{hwReturned}/{hwTotal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Access Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Monitor size={16} /> Access Revocation
            </div>
            {access.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', fontStyle: 'italic' }}>No system access records to revoke</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {access.map(a => {
                  const isRevoked = a.status === 'revoked';
                  const isPending = a.status === 'active';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: isPending ? 'var(--color-error-hl)' : 'var(--color-surface-offset)', fontSize: '0.75rem' }}>
                      {isRevoked ? (
                        <CheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={14} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <strong>{a.system_name}</strong>
                        {a.account_username && <span style={{ color: 'var(--color-tx-muted)' }}> ({a.account_username})</span>}
                      </div>
                      {isRevoked ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>
                          Revoked {formatDate(a.revoked_date)} by {a.revoked_by}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-error)' }}>PENDING</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hardware Checklist */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Laptop size={16} /> Hardware Returns
            </div>
            {hardware.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', fontStyle: 'italic' }}>No hardware assigned</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {hardware.map(h => {
                  const isReturned = !!h.returned_date;
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: !isReturned ? 'var(--color-error-hl)' : 'var(--color-surface-offset)', fontSize: '0.75rem' }}>
                      {isReturned ? (
                        <CheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={14} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <strong>{h.device_type}</strong>
                        {h.model_description && <span style={{ color: 'var(--color-tx-muted)' }}> — {h.model_description}</span>}
                        {h.serial_number && <span style={{ color: 'var(--color-tx-muted)', fontSize: '0.7rem' }}> (SN: {h.serial_number})</span>}
                      </div>
                      {isReturned ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>
                          Returned {formatDate(h.returned_date)} — {h.condition_on_return}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-error)' }}>NOT RETURNED</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status */}
          <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: isComplete || isEmpty ? 'rgba(0, 200, 117, 0.1)' : 'var(--color-error-hl)' }}>
            {isComplete || isEmpty ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 700 }}>
                <CheckCircle size={18} /> Offboarding Complete
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-error)', fontWeight: 700 }}>
                <AlertTriangle size={18} /> Offboarding Incomplete — Action Required
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-divider)' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            <Copy size={14} /> Copy to Clipboard
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
            <Download size={14} /> Download .txt
          </button>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
