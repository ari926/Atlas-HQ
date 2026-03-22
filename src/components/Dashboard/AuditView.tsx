import { useState, useEffect, useMemo } from 'react';
import { X, Printer, Copy, CheckCircle, AlertTriangle, Clock, ShieldCheck, CreditCard, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, daysUntil } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultState?: string;
}

interface ComplianceItem {
  id: string; title: string; category: string; status: string; state: string | null;
  due_date: string | null; score_weight: number; regulation_ref: string | null;
}
interface License {
  id: string; license_type: string; license_category: string | null; state: string;
  status: string; expiration_date: string | null; license_number: string | null;
}
interface Employee {
  id: string; first_name: string; last_name: string; status: string;
  bg_check_status: string | null; bg_check_expiry: string | null;
  drug_test_status: string | null; drug_test_next: string | null;
  medical_card_expiry: string | null; cannabis_permit_state: string | null;
}

const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV', 'UT', 'NV'];

export default function AuditView({ open, onClose, defaultState }: Props) {
  const [selectedState, setSelectedState] = useState(defaultState || 'PA');
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedState(defaultState || 'PA');
    async function load() {
      setLoading(true);
      const [compRes, licRes, empRes] = await Promise.all([
        supabase.from('hq_compliance_items').select('id, title, category, status, state, due_date, score_weight, regulation_ref'),
        supabase.from('hq_licenses').select('id, license_type, license_category, state, status, expiration_date, license_number'),
        supabase.from('hq_employees').select('id, first_name, last_name, status, bg_check_status, bg_check_expiry, drug_test_status, drug_test_next, medical_card_expiry, cannabis_permit_state'),
      ]);
      setCompliance((compRes.data || []) as ComplianceItem[]);
      setLicenses((licRes.data || []) as License[]);
      setEmployees((empRes.data || []) as Employee[]);
      setLoading(false);
    }
    load();
  }, [open, defaultState]);

  // Filtered data
  const stateCompliance = useMemo(() => compliance.filter(c => c.state === selectedState), [compliance, selectedState]);
  const stateLicenses = useMemo(() => licenses.filter(l => l.state === selectedState), [licenses, selectedState]);
  const stateEmployees = useMemo(() => employees.filter(e => e.status === 'Active' && e.cannabis_permit_state === selectedState), [employees, selectedState]);

  // Score
  const score = useMemo(() => {
    const applicable = stateCompliance.filter(c => c.status !== 'Not Applicable');
    if (applicable.length === 0) return 100;
    const totalWeight = applicable.reduce((s, c) => s + (c.score_weight || 1), 0);
    const compliantWeight = applicable.filter(c => c.status === 'Compliant').reduce((s, c) => s + (c.score_weight || 1), 0);
    return totalWeight > 0 ? Math.round((compliantWeight / totalWeight) * 100) : 0;
  }, [stateCompliance]);

  // Group compliance by category
  const compByCategory = useMemo(() => {
    const map = new Map<string, ComplianceItem[]>();
    stateCompliance.forEach(c => {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    });
    return map;
  }, [stateCompliance]);

  // Copy summary
  const handleCopy = () => {
    const now = new Date().toLocaleDateString();
    const lines = [
      `TALARIA TRANSPORTATION — ${selectedState} STATE AUDIT REPORT`,
      `Generated: ${now}`,
      `Compliance Score: ${score}%`,
      '',
      `COMPLIANCE ITEMS (${stateCompliance.length}):`,
      ...stateCompliance.map(c => `  [${c.status}] ${c.title}${c.due_date ? ` — Due: ${formatDate(c.due_date)}` : ''}`),
      '',
      `LICENSES (${stateLicenses.length}):`,
      ...stateLicenses.map(l => `  [${l.status}] ${l.license_category || l.license_type}${l.license_number ? ` #${l.license_number}` : ''}${l.expiration_date ? ` — Exp: ${formatDate(l.expiration_date)}` : ''}`),
      '',
      `PERSONNEL WITH ${selectedState} PERMITS (${stateEmployees.length}):`,
      ...stateEmployees.map(e => `  ${e.first_name} ${e.last_name}${e.bg_check_expiry ? ` — BG: ${formatDate(e.bg_check_expiry)}` : ''}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Audit report copied to clipboard');
  };

  const handlePrint = () => window.print();

  if (!open) return null;

  const statusIcon = (status: string) => {
    if (status === 'Compliant') return <CheckCircle size={12} style={{ color: 'var(--color-success)' }} />;
    if (status === 'Overdue') return <AlertTriangle size={12} style={{ color: 'var(--color-error)' }} />;
    if (status === 'Due Soon') return <Clock size={12} style={{ color: 'var(--color-warning)' }} />;
    return <Clock size={12} style={{ color: 'var(--color-tx-muted)' }} />;
  };

  const scoreColor = score >= 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="audit-overlay">
      <div className="audit-container">
        {/* Header */}
        <div className="audit-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>State Audit Report</h2>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>
              Comprehensive compliance package for state inspection
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="state-filter-select"
              style={{ fontSize: 'var(--text-sm)', padding: '0.375rem 0.5rem', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-offset)' }}
            >
              {STATES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              <Copy size={14} /> Copy
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={14} /> Print
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-tx-muted)' }}>Loading audit data...</div>
        ) : (
          <div className="audit-body">
            {/* Score Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}%</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Compliance Score</div>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stateCompliance.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)' }}>Compliance Items</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stateLicenses.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)' }}>Licenses</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stateEmployees.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)' }}>Personnel</div>
                </div>
              </div>
            </div>

            {/* Compliance Section */}
            <div className="audit-section">
              <h3 className="audit-section-title">
                <ShieldCheck size={16} /> Compliance Items
              </h3>
              {stateCompliance.length === 0 ? (
                <p className="audit-empty">No compliance items for {selectedState}</p>
              ) : (
                Array.from(compByCategory.entries()).map(([category, items]) => (
                  <div key={category} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
                      {category}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {items.map(item => (
                        <div key={item.id} className="audit-row">
                          {statusIcon(item.status)}
                          <span className="audit-row-title">{item.title}</span>
                          <span className={`badge ${item.status === 'Compliant' ? 'badge-success' : item.status === 'Overdue' ? 'badge-error' : 'badge-muted'}`} style={{ fontSize: '0.6rem' }}>
                            {item.status}
                          </span>
                          {item.due_date && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)', flexShrink: 0 }}>
                              {formatDate(item.due_date)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Licenses Section */}
            <div className="audit-section">
              <h3 className="audit-section-title">
                <CreditCard size={16} /> Licenses & Permits
              </h3>
              {stateLicenses.length === 0 ? (
                <p className="audit-empty">No licenses for {selectedState}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {stateLicenses.map(l => {
                    const days = daysUntil(l.expiration_date);
                    const isExpired = days !== null && days < 0;
                    return (
                      <div key={l.id} className="audit-row">
                        <CreditCard size={12} style={{ color: isExpired ? 'var(--color-error)' : 'var(--color-blue)', flexShrink: 0 }} />
                        <span className="audit-row-title">{l.license_category || l.license_type}</span>
                        {l.license_number && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>#{l.license_number}</span>
                        )}
                        <span className={`badge ${l.status === 'Active' ? 'badge-success' : l.status === 'Expired' ? 'badge-error' : 'badge-muted'}`} style={{ fontSize: '0.6rem' }}>
                          {l.status}
                        </span>
                        {l.expiration_date && (
                          <span style={{ fontSize: '0.7rem', color: isExpired ? 'var(--color-error)' : 'var(--color-tx-muted)', flexShrink: 0, fontWeight: isExpired ? 600 : 400 }}>
                            Exp: {formatDate(l.expiration_date)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Personnel Section */}
            <div className="audit-section">
              <h3 className="audit-section-title">
                <Users size={16} /> Personnel ({selectedState} Permits)
              </h3>
              {stateEmployees.length === 0 ? (
                <p className="audit-empty">No employees with {selectedState} cannabis permits</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {stateEmployees.map(e => {
                    const bgDays = daysUntil(e.bg_check_expiry);
                    const medDays = daysUntil(e.medical_card_expiry);
                    return (
                      <div key={e.id} className="audit-row">
                        <Users size={12} style={{ color: 'var(--color-purple)', flexShrink: 0 }} />
                        <span className="audit-row-title">{e.first_name} {e.last_name}</span>
                        {e.bg_check_expiry && (
                          <span style={{ fontSize: '0.65rem', color: bgDays !== null && bgDays <= 30 ? 'var(--color-warning)' : 'var(--color-tx-muted)' }}>
                            BG: {formatDate(e.bg_check_expiry)}
                          </span>
                        )}
                        {e.drug_test_status && (
                          <span className={`badge ${e.drug_test_status === 'current' ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '0.6rem' }}>
                            Drug: {e.drug_test_status}
                          </span>
                        )}
                        {e.medical_card_expiry && (
                          <span style={{ fontSize: '0.65rem', color: medDays !== null && medDays <= 30 ? 'var(--color-warning)' : 'var(--color-tx-muted)' }}>
                            Med: {formatDate(e.medical_card_expiry)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', fontSize: '0.65rem', color: 'var(--color-tx-muted)', textAlign: 'center' }}>
              Talaria Transportation LLC — {selectedState} Audit Report — Generated {new Date().toLocaleDateString()} — Atlas HQ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
