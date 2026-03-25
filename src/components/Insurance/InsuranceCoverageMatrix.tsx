import { useMemo } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { STATES } from '../../lib/utils';

interface Policy {
  id: string;
  policy_type: string;
  state: string | null;
  status: string;
  coverage_amount: number | null;
}

const POLICY_TYPES = [
  'General Liability',
  'Commercial Auto',
  'Cargo / Goods in Transit',
  'Workers Compensation',
  'Professional Liability (E&O)',
  'Umbrella / Excess Liability',
  'Property',
  'Product Liability',
  'Cyber Liability',
  'Directors & Officers (D&O)',
  'Employment Practices (EPLI)',
  'Surety Bond',
];

/* Required policy types for cannabis transportation */
const REQUIRED_TYPES = [
  'General Liability',
  'Commercial Auto',
  'Cargo / Goods in Transit',
  'Workers Compensation',
];

interface Props {
  policies: Policy[];
  onCellClick: (policyType: string, state: string) => void;
}

export default function InsuranceCoverageMatrix({ policies, onCellClick }: Props) {
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Policy[]>> = {};
    for (const type of POLICY_TYPES) {
      m[type] = {};
      for (const st of STATES) {
        m[type][st] = policies.filter(p =>
          p.policy_type === type && (p.state === st || p.state === 'Company-wide') &&
          p.status !== 'Cancelled'
        );
      }
    }
    return m;
  }, [policies]);

  // Count gaps: required types missing in active states
  const gaps = useMemo(() => {
    let count = 0;
    for (const type of REQUIRED_TYPES) {
      for (const st of STATES) {
        const active = matrix[type]?.[st]?.filter(p => p.status === 'Active' || p.status === 'Expiring Soon') || [];
        if (active.length === 0) count++;
      }
    }
    return count;
  }, [matrix]);

  return (
    <div>
      {/* Gap alert */}
      {gaps > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'var(--color-error-bg, rgba(225,29,72,0.08))',
          border: '1px solid var(--color-error)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)', color: 'var(--color-error)',
        }}>
          <AlertTriangle size={16} />
          <strong>{gaps} coverage gap{gaps !== 1 ? 's' : ''}</strong> — required policy types missing in operating states
        </div>
      )}

      <div className="table-wrap" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: 200, position: 'sticky', left: 0, background: 'var(--color-surface-offset)', zIndex: 2 }}>Policy Type</th>
              {STATES.map(st => (
                <th key={st} style={{ textAlign: 'center', minWidth: 70 }}>{st}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POLICY_TYPES.map(type => {
              const isRequired = REQUIRED_TYPES.includes(type);
              return (
                <tr key={type}>
                  <td style={{
                    fontWeight: 500, fontSize: 'var(--text-xs)',
                    position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1,
                  }}>
                    {type}
                    {isRequired && (
                      <span style={{ marginLeft: '0.375rem', fontSize: '0.6rem', color: 'var(--color-error)', fontWeight: 600 }}>REQ</span>
                    )}
                  </td>
                  {STATES.map(st => {
                    const cellPolicies = matrix[type][st];
                    const hasActive = cellPolicies.some(p => p.status === 'Active');
                    const hasExpiring = cellPolicies.some(p => p.status === 'Expiring Soon');
                    const hasExpired = cellPolicies.some(p => p.status === 'Expired');
                    const isEmpty = cellPolicies.length === 0;
                    const isGap = isEmpty && isRequired;

                    return (
                      <td key={st} style={{ textAlign: 'center', padding: '0.5rem' }}>
                        {isEmpty ? (
                          isGap ? (
                            <button
                              className="compliance-matrix-cell"
                              data-status="red"
                              onClick={() => onCellClick(type, st)}
                              title="Coverage gap — no active policy"
                              style={{ cursor: 'pointer' }}
                            >
                              <AlertTriangle size={12} />
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)' }}>—</span>
                          )
                        ) : (
                          <button
                            className="compliance-matrix-cell"
                            data-status={hasExpired ? 'red' : hasExpiring ? 'yellow' : hasActive ? 'green' : 'none'}
                            onClick={() => onCellClick(type, st)}
                            title={`${cellPolicies.length} polic${cellPolicies.length > 1 ? 'ies' : 'y'} — click to view`}
                          >
                            {hasActive && !hasExpiring && !hasExpired ? (
                              <CheckCircle size={12} />
                            ) : (
                              cellPolicies.length
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Summary row */}
            <tr style={{ borderTop: '2px solid var(--color-divider)' }}>
              <td style={{ fontWeight: 600, fontSize: 'var(--text-xs)', position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                Coverage Count
              </td>
              {STATES.map(st => {
                const count = POLICY_TYPES.filter(type => {
                  const cellPolicies = matrix[type][st];
                  return cellPolicies.some(p => p.status === 'Active' || p.status === 'Expiring Soon');
                }).length;
                return (
                  <td key={st} style={{ textAlign: 'center', fontWeight: 600, fontSize: 'var(--text-xs)', color: count > 0 ? 'var(--color-success)' : 'var(--color-tx-faint)' }}>
                    {count > 0 ? count : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
