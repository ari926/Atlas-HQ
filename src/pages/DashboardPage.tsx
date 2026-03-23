import { useEffect, useState, useMemo } from 'react';
import { LayoutDashboard, ShieldCheck, CreditCard, Users, AlertTriangle, Clock, CheckCircle, TrendingUp, FileText, Truck, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil, timeAgo, STATES } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useStateFilter } from '../stores/stateFilterStore';
import QuickActions from '../components/Dashboard/QuickActions';
import StateMap from '../components/Dashboard/StateMap';
import AuditView from '../components/Dashboard/AuditView';
import BulkImport from '../components/common/BulkImport';

/* ─── Types ─── */
interface ComplianceItem {
  id: string;
  title: string;
  category: string;
  status: string;
  state: string | null;
  due_date: string | null;
  score_weight: number;
}

interface License {
  id: string;
  license_type: string;
  license_category: string | null;
  state: string;
  status: string;
  expiration_date: string | null;
  renewal_date: string | null;
  renewal_fee: number | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  department: string | null;
  bg_check_status: string | null;
  bg_check_expiry: string | null;
  drug_test_status: string | null;
  drug_test_next: string | null;
  medical_card_expiry: string | null;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  oln_expiration: string | null;
}

interface DashStats {
  activeProjects: number;
  openTasks: number;
  compliance: ComplianceItem[];
  licenses: License[];
  employees: Employee[];
  drivers: Driver[];
  recentActivity: { action: string; user_name: string; created_at: string }[];
}

/* ─── Compliance Score ─── */
function calcComplianceScore(items: ComplianceItem[], stateFilter?: string) {
  const applicable = items.filter(i => {
    if (i.status === 'Not Applicable') return false;
    if (stateFilter && i.state !== stateFilter) return false;
    return true;
  });
  if (applicable.length === 0) return { score: 100, compliant: 0, total: 0 };
  const totalWeight = applicable.reduce((s, i) => s + (i.score_weight || 1), 0);
  const compliantWeight = applicable.filter(i => i.status === 'Compliant').reduce((s, i) => s + (i.score_weight || 1), 0);
  return {
    score: totalWeight > 0 ? Math.round((compliantWeight / totalWeight) * 100) : 0,
    compliant: applicable.filter(i => i.status === 'Compliant').length,
    total: applicable.length,
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-error)';
}

/* ─── Progress Bar Component ─── */
function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
      {label && <span style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)', minWidth: 28, textAlign: 'right' }}>{label}</span>}
      <div style={{ flex: 1, height: 8, background: 'var(--color-surface-offset)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-tx-muted)', minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PHASE 8 — ENHANCED DASHBOARD
   ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const { activeState } = useStateFilter();

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, compRes, licRes, empRes, driverRes, actRes] = await Promise.all([
        supabase.from('hq_projects').select('id, status'),
        supabase.from('hq_tasks').select('id, status'),
        supabase.from('hq_compliance_items').select('id, title, category, status, state, due_date, score_weight'),
        supabase.from('hq_licenses').select('id, license_type, license_category, state, status, expiration_date, renewal_date, renewal_fee'),
        supabase.from('hq_employees').select('id, first_name, last_name, status, department, bg_check_status, bg_check_expiry, drug_test_status, drug_test_next, medical_card_expiry'),
        supabase.from('drivers').select('id, first_name, last_name, is_active, oln_expiration'),
        supabase.from('hq_task_activity').select('action, user_name, created_at').order('created_at', { ascending: false }).limit(10),
      ]);

      setStats({
        activeProjects: (projRes.data || []).filter((p: Record<string, string>) => p.status !== 'Archived' && p.status !== 'Done').length,
        openTasks: (taskRes.data || []).filter((t: Record<string, string>) => t.status !== 'Done').length,
        compliance: (compRes.data || []) as ComplianceItem[],
        licenses: (licRes.data || []) as License[],
        employees: (empRes.data || []) as Employee[],
        drivers: (driverRes.data || []) as Driver[],
        recentActivity: actRes.data || [],
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  /* ─── Computed values ─── */
  const overallScore = useMemo(() => stats ? calcComplianceScore(stats.compliance) : { score: 0, compliant: 0, total: 0 }, [stats]);

  const stateScores = useMemo(() => {
    if (!stats) return {};
    const scores: Record<string, ReturnType<typeof calcComplianceScore>> = {};
    STATES.forEach(st => { scores[st] = calcComplianceScore(stats.compliance, st); });
    return scores;
  }, [stats]);

  const complianceByStatus = useMemo(() => {
    if (!stats) return { Compliant: 0, 'In Progress': 0, 'Due Soon': 0, Overdue: 0, Pending: 0 };
    const counts: Record<string, number> = { Compliant: 0, 'In Progress': 0, 'Due Soon': 0, Overdue: 0, Pending: 0 };
    stats.compliance.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
    return counts;
  }, [stats]);

  const licenseAlerts = useMemo(() => {
    if (!stats) return { expired: 0, expiringSoon: 0, active: 0, upcoming: [] as License[] };
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let expired = 0, expiringSoon = 0, active = 0;
    const upcoming: License[] = [];
    stats.licenses.forEach(l => {
      const days = daysUntil(l.expiration_date);
      if (l.status === 'Expired' || (days !== null && days < 0)) expired++;
      else if (days !== null && days <= 60) { expiringSoon++; upcoming.push(l); }
      else active++;
    });
    upcoming.sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime());
    return { expired, expiringSoon, active, upcoming };
  }, [stats]);

  const hrAlerts = useMemo(() => {
    if (!stats) return { bgExpiring: 0, drugPending: 0, medExpiring: 0, activeCount: 0 };
    const bgExpiring = stats.employees.filter(e => { const d = daysUntil(e.bg_check_expiry); return d !== null && d >= 0 && d <= 30; }).length;
    const drugPending = stats.employees.filter(e => e.drug_test_status === 'pending').length;
    const medExpiring = stats.employees.filter(e => { const d = daysUntil(e.medical_card_expiry); return d !== null && d >= 0 && d <= 30; }).length;
    const activeCount = stats.employees.filter(e => e.status === 'Active').length;
    return { bgExpiring, drugPending, medExpiring, activeCount };
  }, [stats]);

  const driverStats = useMemo(() => {
    if (!stats) return { active: 0, inactive: 0, olnExpiring: 0 };
    const active = stats.drivers.filter(d => d.is_active !== false).length;
    const inactive = stats.drivers.filter(d => d.is_active === false).length;
    const olnExpiring = stats.drivers.filter(d => { const days = daysUntil(d.oln_expiration); return days !== null && days >= 0 && days <= 30; }).length;
    return { active, inactive, olnExpiring };
  }, [stats]);

  /* ─── Action Items — cross-module alerts ─── */
  const actionItems = useMemo(() => {
    if (!stats) return [];
    const items: { icon: typeof AlertTriangle; color: string; text: string; module: string; route: string; urgent: boolean }[] = [];

    // Overdue compliance
    const overdue = stats.compliance.filter(c => c.status === 'Overdue');
    if (overdue.length > 0) {
      items.push({ icon: AlertTriangle, color: 'var(--color-error)', text: `${overdue.length} overdue compliance item${overdue.length > 1 ? 's' : ''}`, module: 'Compliance', route: '/compliance', urgent: true });
    }

    // Due soon compliance
    const dueSoon = stats.compliance.filter(c => c.status === 'Due Soon');
    if (dueSoon.length > 0) {
      items.push({ icon: Clock, color: 'var(--color-warning)', text: `${dueSoon.length} compliance item${dueSoon.length > 1 ? 's' : ''} due within 30 days`, module: 'Compliance', route: '/compliance', urgent: false });
    }

    // Expired licenses
    if (licenseAlerts.expired > 0) {
      items.push({ icon: AlertTriangle, color: 'var(--color-error)', text: `${licenseAlerts.expired} expired license${licenseAlerts.expired > 1 ? 's' : ''}`, module: 'Licensing', route: '/licensing', urgent: true });
    }

    // Expiring licenses
    if (licenseAlerts.expiringSoon > 0) {
      items.push({ icon: CreditCard, color: 'var(--color-warning)', text: `${licenseAlerts.expiringSoon} license${licenseAlerts.expiringSoon > 1 ? 's' : ''} expiring within 60 days`, module: 'Licensing', route: '/licensing', urgent: false });
    }

    // BG checks expiring
    if (hrAlerts.bgExpiring > 0) {
      items.push({ icon: ShieldCheck, color: 'var(--color-warning)', text: `${hrAlerts.bgExpiring} background check${hrAlerts.bgExpiring > 1 ? 's' : ''} expiring soon`, module: 'HR', route: '/hr', urgent: false });
    }

    // Drug tests pending
    if (hrAlerts.drugPending > 0) {
      items.push({ icon: AlertTriangle, color: 'var(--color-orange)', text: `${hrAlerts.drugPending} drug test${hrAlerts.drugPending > 1 ? 's' : ''} pending`, module: 'HR', route: '/hr', urgent: false });
    }

    // OLN expiring
    if (driverStats.olnExpiring > 0) {
      items.push({ icon: Truck, color: 'var(--color-warning)', text: `${driverStats.olnExpiring} driver license${driverStats.olnExpiring > 1 ? 's' : ''} expiring within 30 days`, module: 'Drivers', route: '/hr', urgent: false });
    }

    // Medical card expiring
    if (hrAlerts.medExpiring > 0) {
      items.push({ icon: FileText, color: 'var(--color-warning)', text: `${hrAlerts.medExpiring} medical card${hrAlerts.medExpiring > 1 ? 's' : ''} expiring soon`, module: 'HR', route: '/hr', urgent: false });
    }

    return items.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  }, [stats, licenseAlerts, hrAlerts, driverStats]);

  /* ─── Audit Readiness Score ─── */
  const auditScore = useMemo(() => {
    if (!stats) return 0;
    let score = 0;
    let factors = 0;

    // Compliance score (weight: 40)
    score += overallScore.score * 0.4;
    factors += 40;

    // License health (weight: 25)
    const totalLic = stats.licenses.length;
    if (totalLic > 0) {
      const activeLic = licenseAlerts.active;
      score += (activeLic / totalLic) * 25;
    } else {
      score += 25;
    }
    factors += 25;

    // HR credentials (weight: 20)
    const totalEmp = stats.employees.filter(e => e.status === 'Active').length;
    if (totalEmp > 0) {
      const credIssues = hrAlerts.bgExpiring + hrAlerts.drugPending + hrAlerts.medExpiring;
      const credScore = Math.max(0, 1 - (credIssues / totalEmp));
      score += credScore * 20;
    } else {
      score += 20;
    }
    factors += 20;

    // Driver compliance (weight: 15)
    const totalDrivers = stats.drivers.filter(d => d.is_active).length;
    if (totalDrivers > 0) {
      const driverIssues = driverStats.olnExpiring;
      const driverScore = Math.max(0, 1 - (driverIssues / totalDrivers));
      score += driverScore * 15;
    } else {
      score += 15;
    }
    factors += 15;

    return Math.round((score / factors) * 100);
  }, [stats, overallScore, licenseAlerts, hrAlerts, driverStats]);

  /* ─── Upcoming deadlines (merged) ─── */
  const deadlines = useMemo(() => {
    if (!stats) return [];
    const items: { type: string; title: string; date: string; status: string; route: string }[] = [];
    stats.compliance.forEach(c => {
      if (c.due_date && c.status !== 'Compliant' && c.status !== 'Not Applicable') {
        items.push({ type: 'Compliance', title: c.title, date: c.due_date, status: c.status, route: '/compliance' });
      }
    });
    stats.licenses.forEach(l => {
      if (l.expiration_date && l.status !== 'Revoked') {
        items.push({ type: 'License', title: `${l.license_type} (${l.state})`, date: l.expiration_date, status: l.status, route: '/licensing' });
      }
    });
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items.slice(0, 12);
  }, [stats]);

  /* ─── Renewal costs coming up ─── */
  const upcomingRenewalCost = useMemo(() => {
    if (!stats) return 0;
    return stats.licenses
      .filter(l => { const d = daysUntil(l.expiration_date); return d !== null && d >= 0 && d <= 90; })
      .reduce((sum, l) => sum + (l.renewal_fee || 0), 0);
  }, [stats]);

  /* ─── State Map Data ─── */
  const stateMapData = useMemo(() => {
    if (!stats) return [];
    return STATES.map(st => {
      const s = calcComplianceScore(stats.compliance, st);
      const licCount = stats.licenses.filter(l => l.state === st).length;
      return {
        state: st,
        complianceScore: s.score,
        licenseCount: licCount,
        hasActivity: s.total > 0 || licCount > 0,
      };
    }).filter(d => d.hasActivity);
  }, [stats]);

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;
  if (!stats) return (
    <div className="empty-state" style={{ padding: '4rem' }}>
      <AlertTriangle size={48} strokeWidth={1} />
      <div className="empty-state-title">Unable to load dashboard</div>
      <div className="empty-state-text">There was a problem loading data. Try refreshing the page.</div>
    </div>
  );

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Dashboard</h1>
          <p className="view-subtitle">Talaria HQ — Corporate Command Center</p>
        </div>
      </div>

      {/* ═══ Row 1: KPI Cards ═══ */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* Audit Readiness */}
        <div className="kpi-card" style={{ borderLeft: `3px solid ${scoreColor(auditScore)}` }}>
          <div className={`kpi-icon ${auditScore >= 80 ? 'green' : auditScore >= 50 ? 'orange' : 'red'}`}>
            <CheckCircle size={20} />
          </div>
          <div className="kpi-label">Audit Readiness</div>
          <div className="kpi-value" style={{ color: scoreColor(auditScore) }}>{auditScore}%</div>
          <div className="kpi-delta">across all modules</div>
        </div>

        {/* Projects */}
        <div className="kpi-card" onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon teal"><LayoutDashboard size={20} /></div>
          <div className="kpi-label">Active Projects</div>
          <div className="kpi-value">{stats.activeProjects}</div>
          <div className="kpi-delta">{stats.openTasks} open tasks</div>
        </div>

        {/* Compliance */}
        <div className="kpi-card" onClick={() => navigate('/compliance')} style={{ cursor: 'pointer', borderLeft: `3px solid ${scoreColor(overallScore.score)}` }}>
          <div className={`kpi-icon ${complianceByStatus.Overdue > 0 ? 'red' : 'green'}`}><ShieldCheck size={20} /></div>
          <div className="kpi-label">Compliance Score</div>
          <div className="kpi-value" style={{ color: scoreColor(overallScore.score) }}>{overallScore.score}%</div>
          <div className="kpi-delta">{overallScore.compliant}/{overallScore.total} compliant</div>
        </div>

        {/* Licenses */}
        <div className="kpi-card" onClick={() => navigate('/licensing')} style={{ cursor: 'pointer' }}>
          <div className={`kpi-icon ${licenseAlerts.expired > 0 ? 'red' : licenseAlerts.expiringSoon > 0 ? 'orange' : 'blue'}`}><CreditCard size={20} /></div>
          <div className="kpi-label">Licenses</div>
          <div className="kpi-value">{stats.licenses.length}</div>
          <div className="kpi-delta" style={licenseAlerts.expired > 0 ? { color: 'var(--color-error)' } : licenseAlerts.expiringSoon > 0 ? { color: 'var(--color-warning)' } : undefined}>
            {licenseAlerts.expired > 0 ? `${licenseAlerts.expired} expired` : licenseAlerts.expiringSoon > 0 ? `${licenseAlerts.expiringSoon} expiring soon` : 'All current'}
          </div>
        </div>

        {/* Workforce */}
        <div className="kpi-card" onClick={() => navigate('/hr')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon blue"><Users size={20} /></div>
          <div className="kpi-label">Workforce</div>
          <div className="kpi-value">{hrAlerts.activeCount + driverStats.active}</div>
          <div className="kpi-delta">{hrAlerts.activeCount} staff · {driverStats.active} drivers</div>
        </div>
      </div>

      {/* ═══ Quick Actions ═══ */}
      <QuickActions onOpenAudit={() => setAuditOpen(true)} onOpenImport={() => setImportOpen(true)} />

      {/* ═══ State Coverage Map ═══ */}
      {stateMapData.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            <LayoutDashboard size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            State Coverage
          </div>
          <StateMap stateData={stateMapData} />
        </div>
      )}

      {/* ═══ Row 2: Action Items + Compliance Breakdown ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Action Items */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ margin: 0 }}>
              <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
              Action Items
            </div>
            {actionItems.length > 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)', background: actionItems.some(a => a.urgent) ? 'var(--color-error-hl)' : 'var(--color-warning-hl)', color: actionItems.some(a => a.urgent) ? 'var(--color-error)' : 'var(--color-warning)' }}>
                {actionItems.length}
              </span>
            )}
          </div>
          {actionItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--color-success)' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>All Clear</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>No items require attention</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {actionItems.map((item, i) => (
                <div
                  key={i}
                  onClick={() => navigate(item.route)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: 'var(--radius-md)', background: item.urgent ? 'var(--color-error-hl)' : 'var(--color-surface-offset)', cursor: 'pointer', transition: 'background var(--transition-interactive)' }}
                >
                  <item.icon size={14} style={{ color: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-tx)' }}>{item.text}</span>
                  <span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>{item.module}</span>
                  <ArrowRight size={12} style={{ color: 'var(--color-tx-faint)' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compliance Health Breakdown */}
        <div className="card">
          <div className="card-title">
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            Compliance Health
          </div>

          {/* Status bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            <ProgressBar value={complianceByStatus.Compliant} max={stats.compliance.length} color="var(--color-success)" label="OK" />
            <ProgressBar value={complianceByStatus['In Progress']} max={stats.compliance.length} color="var(--color-blue)" label="WIP" />
            <ProgressBar value={complianceByStatus['Due Soon']} max={stats.compliance.length} color="var(--color-warning)" label="Soon" />
            <ProgressBar value={complianceByStatus.Overdue} max={stats.compliance.length} color="var(--color-error)" label="Late" />
            <ProgressBar value={complianceByStatus.Pending} max={stats.compliance.length} color="var(--color-tx-faint)" label="Pend" />
          </div>

          {/* Per-state scores */}
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Per-State Scores</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {STATES.map(st => {
                const s = stateScores[st];
                if (!s || s.total === 0) return null;
                return (
                  <span
                    key={st}
                    style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-offset)', color: scoreColor(s.score), border: `1px solid ${scoreColor(s.score)}30` }}
                  >
                    {st}: {s.score}%
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 3: License Timeline + HR Credentials ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* License Expiration Timeline */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ margin: 0 }}>
              <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
              License Timeline
            </div>
            {upcomingRenewalCost > 0 && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                ${upcomingRenewalCost.toLocaleString()} renewal costs (90d)
              </span>
            )}
          </div>
          {stats.licenses.length === 0 ? (
            <p style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)' }}>No licenses tracked</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {stats.licenses
                .filter(l => l.expiration_date)
                .sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime())
                .map(l => {
                  const days = daysUntil(l.expiration_date);
                  const isExpired = days !== null && days < 0;
                  const isWarning = days !== null && days >= 0 && days <= 60;
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid var(--color-divider)', fontSize: '0.75rem' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.6rem', minWidth: 28, textAlign: 'center' }}>{l.state}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.license_category || l.license_type}</span>
                      <span style={{ fontSize: '0.7rem', color: isExpired ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : 'var(--color-tx-muted)', fontWeight: isExpired || isWarning ? 600 : 400, flexShrink: 0 }}>
                        {formatDate(l.expiration_date)}
                        {isExpired && days !== null && ` (${Math.abs(days)}d ago)`}
                        {isWarning && days !== null && ` (${days}d)`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* HR Credentials Status */}
        <div className="card">
          <div className="card-title">
            <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            Workforce Credentials
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            {/* Staff stats */}
            <div style={{ padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Staff</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Active</span><span style={{ fontWeight: 600 }}>{hrAlerts.activeCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>BG Expiring</span>
                  <span style={{ fontWeight: 600, color: hrAlerts.bgExpiring > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{hrAlerts.bgExpiring}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Drug Tests Pending</span>
                  <span style={{ fontWeight: 600, color: hrAlerts.drugPending > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{hrAlerts.drugPending}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Med Cards Expiring</span>
                  <span style={{ fontWeight: 600, color: hrAlerts.medExpiring > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{hrAlerts.medExpiring}</span>
                </div>
              </div>
            </div>

            {/* Driver stats */}
            <div style={{ padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Drivers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Active</span><span style={{ fontWeight: 600 }}>{driverStats.active}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Inactive</span><span style={{ fontWeight: 600, color: 'var(--color-tx-muted)' }}>{driverStats.inactive}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>OLN Expiring</span>
                  <span style={{ fontWeight: 600, color: driverStats.olnExpiring > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{driverStats.olnExpiring}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>Total Fleet</span><span style={{ fontWeight: 600 }}>{driverStats.active + driverStats.inactive}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Department breakdown */}
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>By Department</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {Object.entries(
                stats.employees.filter(e => e.status === 'Active').reduce((acc, e) => {
                  const dept = e.department || 'Unassigned';
                  acc[dept] = (acc[dept] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                <span key={dept} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-offset)', color: 'var(--color-tx-muted)' }}>
                  {dept}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 4: Deadlines + Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Upcoming deadlines */}
        <div className="card">
          <div className="card-title">
            <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            Upcoming Deadlines
          </div>
          {deadlines.length === 0 ? (
            <p style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)', marginTop: '0.75rem' }}>No upcoming deadlines</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem' }}>
              {deadlines.map((d, i) => {
                const days = daysUntil(d.date);
                const isOverdue = days !== null && days < 0;
                return (
                  <div
                    key={i}
                    onClick={() => navigate(d.route)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)', padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background var(--transition-interactive)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-offset)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', overflow: 'hidden' }}>
                      <span className="badge badge-muted" style={{ fontSize: '0.6rem', flexShrink: 0 }}>{d.type}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    </div>
                    <span style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-tx-muted)', flexShrink: 0, marginLeft: '0.5rem', fontWeight: isOverdue ? 600 : 400 }}>
                      {formatDate(d.date)}
                      {isOverdue && days !== null && ` (${Math.abs(days)}d)`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-title">
            <TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
            Recent Activity
          </div>
          {stats.recentActivity.length === 0 ? (
            <p style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)', marginTop: '0.75rem' }}>No recent activity</p>
          ) : (
            <div className="activity-feed" style={{ marginTop: '0.75rem' }}>
              {stats.recentActivity.map((a, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-dot" style={{ background: 'var(--color-primary)' }} />
                  <div>
                    <div className="activity-text"><strong>{a.user_name}</strong> {a.action}</div>
                    <div className="activity-time">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Audit Mode ═══ */}
      <AuditView
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        defaultState={activeState}
      />

      {/* ═══ Bulk Import ═══ */}
      <BulkImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={() => window.location.reload()}
      />
    </div>
  );
}
