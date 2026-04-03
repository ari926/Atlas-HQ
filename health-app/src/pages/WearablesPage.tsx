import { Watch, Link } from 'lucide-react';

const WEARABLES = [
  { id: 'oura', name: 'Oura Ring', description: 'Sleep, readiness, activity, heart rate, HRV', icon: '💍' },
  { id: 'whoop', name: 'Whoop', description: 'Recovery, strain, sleep, HRV, SpO2', icon: '🏋️' },
  { id: 'apple_watch', name: 'Apple Watch', description: 'Activity, heart rate, workouts, sleep (via Vital)', icon: '⌚' },
  { id: 'eight_sleep', name: 'Eight Sleep', description: 'Sleep tracking, bed temperature, HR, HRV (via Vital)', icon: '🛏️' },
];

export default function WearablesPage() {
  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Wearables</h1>
          <p className="view-subtitle">Connect health wearables for live data feeds</p>
        </div>
      </div>

      <div className="wearable-grid">
        {WEARABLES.map(w => (
          <div key={w.id} className="wearable-card">
            <div className="wearable-card-icon">{w.icon}</div>
            <div className="wearable-card-info">
              <h3>{w.name}</h3>
              <p>{w.description}</p>
            </div>
            <button className="btn btn-secondary btn-sm">
              <Link size={14} /> Connect
            </button>
          </div>
        ))}
      </div>

      <div className="empty-state" style={{ marginTop: '2rem' }}>
        <Watch size={48} />
        <h2>Wearable integrations coming soon</h2>
        <p>Oura Ring and Whoop will connect directly. Apple Watch and Eight Sleep will use the Vital API for data syncing.</p>
      </div>
    </div>
  );
}
