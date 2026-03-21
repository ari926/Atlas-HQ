import { useMemo } from 'react';
import { DollarSign, TrendingUp, Calendar, Shield } from 'lucide-react';
import { daysUntil } from '../../lib/utils';

interface License {
  id: string;
  state: string;
  status: string;
  annual_fee: number | null;
  renewal_fee: number | null;
  application_fee: number | null;
  expiration_date: string | null;
}

interface Props {
  licenses: License[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function LicenseCostSummary({ licenses }: Props) {
  const stats = useMemo(() => {
    const active = licenses.filter(l => l.status === 'Active');
    const totalAnnual = active.reduce((s, l) => s + (l.annual_fee || 0), 0);
    const totalRenewal = active.reduce((s, l) => s + (l.renewal_fee || 0), 0);

    // Renewals due within next 12 months
    const upcomingRenewalCost = active
      .filter(l => {
        const days = daysUntil(l.expiration_date);
        return days !== null && days >= 0 && days <= 365;
      })
      .reduce((s, l) => s + (l.renewal_fee || 0), 0);

    // Upcoming within 90 days
    const renewingSoon = active.filter(l => {
      const days = daysUntil(l.expiration_date);
      return days !== null && days >= 0 && days <= 90;
    }).length;

    return { totalActive: active.length, totalAnnual, totalRenewal, upcomingRenewalCost, renewingSoon };
  }, [licenses]);

  return (
    <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
      <div className="kpi-card">
        <div className="kpi-icon teal"><Shield size={20} /></div>
        <div className="kpi-label">Active Licenses</div>
        <div className="kpi-value">{stats.totalActive}</div>
        <div className="kpi-delta">{licenses.length} total</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon blue"><DollarSign size={20} /></div>
        <div className="kpi-label">Annual Cost</div>
        <div className="kpi-value">{formatCurrency(stats.totalAnnual)}</div>
        <div className="kpi-delta">across all active licenses</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon orange"><TrendingUp size={20} /></div>
        <div className="kpi-label">Renewal Cost (12mo)</div>
        <div className="kpi-value">{formatCurrency(stats.upcomingRenewalCost)}</div>
        <div className="kpi-delta">{formatCurrency(stats.totalRenewal)} total renewal fees</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon red"><Calendar size={20} /></div>
        <div className="kpi-label">Expiring Soon</div>
        <div className="kpi-value">{stats.renewingSoon}</div>
        <div className="kpi-delta">within 90 days</div>
      </div>
    </div>
  );
}
