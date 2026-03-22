import { useNavigate } from 'react-router-dom';
import { useStateFilter } from '../../stores/stateFilterStore';

interface StateData {
  state: string;
  complianceScore: number;
  licenseCount: number;
  hasActivity: boolean;
}

interface Props {
  stateData: StateData[];
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export default function StateMap({ stateData }: Props) {
  const navigate = useNavigate();
  const { setActiveState } = useStateFilter();

  const handleClick = (state: string) => {
    setActiveState(state);
    navigate('/compliance');
  };

  if (stateData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-tx-muted)', fontSize: 'var(--text-xs)' }}>
        No state data available
      </div>
    );
  }

  return (
    <div className="state-map-grid">
      {stateData.map(({ state, complianceScore, licenseCount, hasActivity }) => (
        <button
          key={state}
          className="state-tile"
          onClick={() => handleClick(state)}
          title={`${state}: ${complianceScore}% compliance, ${licenseCount} licenses`}
        >
          <div className="state-tile-header">
            <span className="state-tile-name">{state}</span>
            <span
              className="state-tile-dot"
              style={{ background: hasActivity ? 'var(--color-success)' : 'var(--color-tx-faint)' }}
            />
          </div>
          <div className="state-tile-score" style={{ color: scoreColor(complianceScore) }}>
            {complianceScore}%
          </div>
          <div className="state-tile-meta">
            {licenseCount} license{licenseCount !== 1 ? 's' : ''}
          </div>
          {/* Score bar */}
          <div className="state-tile-bar">
            <div
              className="state-tile-bar-fill"
              style={{ width: `${complianceScore}%`, background: scoreColor(complianceScore) }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
