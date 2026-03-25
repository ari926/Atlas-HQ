import { useMemo } from 'react';
import { DollarSign, TrendingUp, Calendar, Shield } from 'lucide-react';
import { daysUntil } from '../../lib/utils';

interface Policy {
  id: string;
  status: string;
  premium_annual: number | null;
  coverage_amount: number | null;
  expiration_date: string | null;
}

interface Props {
  policies: Policy[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function InsuranceCostSummary({ policies }: Props) {
  const stats = useMemo(() => {
    const active = policies.filter(p => p.status === 'Active' || p.status === 'Expiring Soon');
    const totalPremium = active.reduce((s, p) => s + (p.premium_annual || 0), 0);
    const totalCoverage = active.reduce((s, p) => s + (p.coverage_amount || 0), 0);

    const expiringSoon = active.filter(p => {
      const days = daysUntil(p.expiration_date);
      return days !== null && days >= 0 && days <= 90;
    }).length;

    return { totalActive: active.length, total: policies.length, totalPremium, totalCoverage, expiringSoon };
  }, [policies]);

  return (
    <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
      <div className="kpi-card">
        <div className="kpi-icon teal"><Shield size={20} /></div>
        <div className="kpi-label">Active Policies</div>
        <div className="kpi-value">{stats.totalActive}</div>
        <div className="kpi-delta">{stats.total} total</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon blue"><DollarSign size={20} /></div>
        <div className="kpi-label">Annual Premium</div>
        <div className="kpi-value">{formatCurrency(stats.totalPremium)}</div>
        <div className="kpi-delta">across active policies</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon orange"><TrendingUp size={20} /></div>
        <div className="kpi-label">Total Coverage</div>
        <div className="kpi-value">{formatCurrency(stats.totalCoverage)}</div>
        <div className="kpi-delta">combined coverage limits</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon red"><Calendar size={20} /></div>
        <div className="kpi-label">Expiring Soon</div>
        <div className="kpi-value">{stats.expiringSoon}</div>
        <div className="kpi-delta">within 90 days</div>
      </div>
    </div>
  );
}
