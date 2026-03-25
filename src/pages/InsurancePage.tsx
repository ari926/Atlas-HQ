import { useState } from 'react';
import { List, Calendar, Grid3X3 } from 'lucide-react';
import InsuranceTab from '../components/Insurance/InsuranceTab';
import type { InsuranceViewMode } from '../components/Insurance/InsuranceTab';

export default function InsurancePage() {
  const [viewMode, setViewMode] = useState<InsuranceViewMode>('list');

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Insurance</h1>
          <p className="view-subtitle">Insurance policy tracking and coverage management</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="board-view-toggle">
            <button className={`board-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <List size={14} /> List
            </button>
            <button className={`board-view-btn${viewMode === 'calendar' ? ' active' : ''}`} onClick={() => setViewMode('calendar')}>
              <Calendar size={14} /> Calendar
            </button>
            <button className={`board-view-btn${viewMode === 'matrix' ? ' active' : ''}`} onClick={() => setViewMode('matrix')}>
              <Grid3X3 size={14} /> Coverage
            </button>
          </div>
        </div>
      </div>
      <InsuranceTab viewMode={viewMode} />
    </div>
  );
}
