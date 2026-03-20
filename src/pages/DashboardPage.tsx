import { useEffect, useState } from 'react';
import { LayoutDashboard, ShieldCheck, CreditCard, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, daysUntil, timeAgo } from '../lib/utils';

interface DashStats {
  activeProjects: number;
  openTasks: number;
  overdueCompliance: number;
  totalCompliance: number;
  expiringLicenses: number;
  totalLicenses: number;
  activeEmployees: number;
  totalEmployees: number;
  deadlines: { type: string; title: string; date: string; status: string }[];
  recentActivity: { action: string; user_name: string; created_at: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, compRes, licRes, empRes, actRes] = await Promise.all([
        supabase.from('hq_projects').select('id, status'),
        supabase.from('hq_tasks').select('id, status'),
        supabase.from('hq_compliance_items').select('*'),
        supabase.from('hq_licenses').select('*'),
        supabase.from('hq_employees').select('id, status'),
        supabase.from('hq_task_activity').select('action, user_name, created_at').order('created_at', { ascending: false }).limit(10),
      ]);

      const projects = projRes.data || [];
      const tasks = taskRes.data || [];
      const compliance = compRes.data || [];
      const licenses = licRes.data || [];
      const employees = empRes.data || [];

      const now = new Date(); now.setHours(0, 0, 0, 0);
      const thirtyDays = new Date(now.getTime() + 30 * 86400000);

      const deadlines: DashStats['deadlines'] = [];
      compliance.forEach((c: Record<string, string>) => {
        if (c.due_date && c.status !== 'Compliant' && c.status !== 'Not Applicable') {
          deadlines.push({ type: 'Compliance', title: c.title, date: c.due_date, status: c.status });
        }
      });
      licenses.forEach((l: Record<string, string>) => {
        if (l.expiration_date && l.status !== 'Revoked') {
          deadlines.push({ type: 'License', title: `${l.license_type} (${l.state})`, date: l.expiration_date, status: l.status });
        }
      });
      deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setStats({
        activeProjects: projects.filter((p: Record<string, string>) => p.status !== 'Archived' && p.status !== 'Done').length,
        openTasks: tasks.filter((t: Record<string, string>) => t.status !== 'Done').length,
        overdueCompliance: compliance.filter((c: Record<string, string>) => c.due_date && new Date(c.due_date) < now && c.status !== 'Compliant' && c.status !== 'Not Applicable').length,
        totalCompliance: compliance.length,
        expiringLicenses: licenses.filter((l: Record<string, string>) => l.expiration_date && l.status !== 'Revoked' && new Date(l.expiration_date) <= thirtyDays).length,
        totalLicenses: licenses.length,
        activeEmployees: employees.filter((e: Record<string, string>) => e.status === 'Active').length,
        totalEmployees: employees.length,
        deadlines: deadlines.slice(0, 10),
        recentActivity: actRes.data || [],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />;
  if (!stats) return null;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Dashboard</h1>
          <p className="view-subtitle">Corporate command center</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon teal"><LayoutDashboard size={20} /></div>
          <div className="kpi-label">Active Projects</div>
          <div className="kpi-value">{stats.activeProjects}</div>
          <div className="kpi-delta">{stats.openTasks} open tasks</div>
        </div>
        <div className="kpi-card">
          <div className={`kpi-icon ${stats.overdueCompliance > 0 ? 'red' : 'green'}`}><ShieldCheck size={20} /></div>
          <div className="kpi-label">Compliance</div>
          <div className="kpi-value">{stats.overdueCompliance > 0 ? `${stats.overdueCompliance} Overdue` : 'All Clear'}</div>
          <div className="kpi-delta">{stats.totalCompliance} total items tracked</div>
        </div>
        <div className="kpi-card">
          <div className={`kpi-icon ${stats.expiringLicenses > 0 ? 'orange' : 'blue'}`}><CreditCard size={20} /></div>
          <div className="kpi-label">Licenses</div>
          <div className="kpi-value">{stats.totalLicenses}</div>
          <div className="kpi-delta" style={stats.expiringLicenses > 0 ? { color: 'var(--color-warning)' } : undefined}>
            {stats.expiringLicenses > 0 ? `${stats.expiringLicenses} expiring soon` : 'All current'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Users size={20} /></div>
          <div className="kpi-label">Employees</div>
          <div className="kpi-value">{stats.activeEmployees}</div>
          <div className="kpi-delta">{stats.totalEmployees} total records</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Upcoming deadlines */}
        <div className="card">
          <div className="card-title">Upcoming Deadlines</div>
          {stats.deadlines.length === 0 ? (
            <p style={{ color: 'var(--color-tx-faint)', fontSize: 'var(--text-xs)', marginTop: '0.75rem' }}>No upcoming deadlines</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {stats.deadlines.map((d, i) => {
                const days = daysUntil(d.date);
                const isOverdue = days !== null && days < 0;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)', padding: '0.375rem 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <div>
                      <span className="badge badge-muted" style={{ marginRight: '0.375rem' }}>{d.type}</span>
                      {d.title}
                    </div>
                    <span style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-tx-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
                      {formatDate(d.date)}
                      {isOverdue && days !== null && ` (${Math.abs(days)}d overdue)`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-title">Recent Activity</div>
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
    </div>
  );
}
