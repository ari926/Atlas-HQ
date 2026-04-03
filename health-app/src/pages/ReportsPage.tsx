import { useHealthStore } from '../stores/healthStore';
import { FileText, Upload } from 'lucide-react';
import { formatDate } from '../lib/utils';

export default function ReportsPage() {
  const { reports, activeMemberId, familyMembers } = useHealthStore();
  const member = familyMembers.find(m => m.id === activeMemberId);

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Medical Reports</h1>
          <p className="view-subtitle">
            {member ? `${member.first_name}'s uploaded reports and AI analysis` : 'Select a family member'}
          </p>
        </div>
        <button className="btn btn-primary" disabled={!activeMemberId}>
          <Upload size={14} /> Upload Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h2>No reports yet</h2>
          <p>Upload a medical report (PDF or image) and AI will extract the data automatically.</p>
        </div>
      ) : (
        <div className="report-list">
          {reports.map(r => (
            <div key={r.id} className="report-card">
              <div className="report-card-header">
                <FileText size={18} />
                <div>
                  <div className="report-card-title">{r.title}</div>
                  <div className="report-card-meta">
                    {r.report_type.replace(/_/g, ' ')} &middot; {formatDate(r.report_date)}
                  </div>
                </div>
                <span className={`badge badge-${r.processing_status === 'complete' ? 'success' : r.processing_status === 'failed' ? 'error' : 'muted'}`}>
                  {r.processing_status}
                </span>
              </div>
              {r.ai_summary && (
                <p className="report-card-summary">{r.ai_summary}</p>
              )}
              {r.body_regions && r.body_regions.length > 0 && (
                <div className="report-card-regions">
                  {r.body_regions.map(region => (
                    <span key={region} className="badge badge-primary">{region}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
