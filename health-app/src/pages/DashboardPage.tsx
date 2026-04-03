import { useHealthStore } from '../stores/healthStore';
import { Heart, FileText, ShieldAlert, Activity, Clock } from 'lucide-react';
import { formatDate, calculateAge } from '../lib/utils';

export default function DashboardPage() {
  const { familyMembers, activeMemberId, reports, restrictions, metrics, vitals } = useHealthStore();
  const member = familyMembers.find(m => m.id === activeMemberId);

  if (!member) {
    return (
      <div className="empty-state">
        <Heart size={48} />
        <h2>Welcome to Family Health Tracker</h2>
        <p>Add a family member to get started. Go to the Family page to add your first member.</p>
      </div>
    );
  }

  const age = calculateAge(member.date_of_birth);
  const totalReports = reports.length;
  const activeRestrictions = restrictions.filter(r => r.confirmed).length;
  const totalMetrics = metrics.length;
  const latestVital = vitals[0];
  const criticalMetrics = metrics.filter(m => m.status === 'critical' || m.status === 'high' || m.status === 'low').length;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Dashboard</h1>
          <p className="view-subtitle">
            {member.first_name} {member.last_name}
            {age !== null ? ` \u00B7 ${age} years old` : ''}
            {member.blood_type ? ` \u00B7 ${member.blood_type}` : ''}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--color-primary)' }}><FileText size={20} /></div>
          <div className="kpi-label">Reports</div>
          <div className="kpi-value">{totalReports}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--color-warning)' }}><ShieldAlert size={20} /></div>
          <div className="kpi-label">Restrictions</div>
          <div className="kpi-value">{activeRestrictions}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--color-success)' }}><Activity size={20} /></div>
          <div className="kpi-label">Metrics Tracked</div>
          <div className="kpi-value">{totalMetrics}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: criticalMetrics > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
            <Heart size={20} />
          </div>
          <div className="kpi-label">Flagged Metrics</div>
          <div className="kpi-value">{criticalMetrics}</div>
        </div>
      </div>

      {latestVital && (
        <div className="section">
          <h2 className="section-title">Latest Vital</h2>
          <div className="kpi-card" style={{ maxWidth: 300 }}>
            <div className="kpi-icon"><Clock size={20} /></div>
            <div className="kpi-label">{latestVital.vital_type.replace(/_/g, ' ')}</div>
            <div className="kpi-value">
              {latestVital.value_primary}
              {latestVital.value_secondary ? `/${latestVital.value_secondary}` : ''}
              {latestVital.unit ? ` ${latestVital.unit}` : ''}
            </div>
            <div className="kpi-sub">{formatDate(latestVital.recorded_at)}</div>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <div className="section">
          <h2 className="section-title">Recent Reports</h2>
          <div className="list-compact">
            {reports.slice(0, 5).map(r => (
              <div key={r.id} className="list-compact-item">
                <FileText size={14} />
                <span className="list-compact-title">{r.title}</span>
                <span className={`badge badge-${r.processing_status === 'complete' ? 'success' : 'muted'}`}>
                  {r.processing_status}
                </span>
                <span className="list-compact-date">{formatDate(r.report_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {restrictions.length > 0 && (
        <div className="section">
          <h2 className="section-title">Active Restrictions</h2>
          <div className="restriction-chips">
            {restrictions.filter(r => r.confirmed).slice(0, 10).map(r => (
              <span key={r.id} className={`badge badge-${r.severity === 'critical' ? 'error' : r.severity === 'warning' ? 'warning' : 'muted'}`}>
                {r.item_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
