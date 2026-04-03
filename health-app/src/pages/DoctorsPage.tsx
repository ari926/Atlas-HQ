import { Stethoscope, Plus } from 'lucide-react';

export default function DoctorsPage() {
  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Doctors</h1>
          <p className="view-subtitle">Manage doctor access to family health data</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={14} /> Invite Doctor
        </button>
      </div>

      <div className="empty-state">
        <Stethoscope size={48} />
        <h2>No doctors assigned</h2>
        <p>Invite a doctor by email to give them read-only access to your family's health data. They'll be able to view reports, metrics, and wearable data.</p>
      </div>
    </div>
  );
}
