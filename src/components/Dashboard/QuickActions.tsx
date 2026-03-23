import { ShieldCheck, CreditCard, UserPlus, Upload, Search, ClipboardCheck, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  onOpenAudit: () => void;
  onOpenImport: () => void;
}

export default function QuickActions({ onOpenAudit, onOpenImport }: Props) {
  const navigate = useNavigate();
  const { setSearchOpen } = useUIStore();

  const actions = [
    { icon: ShieldCheck, label: 'Add Compliance Item', color: 'var(--color-success)', onClick: () => navigate('/compliance') },
    { icon: CreditCard, label: 'Add License', color: 'var(--color-blue)', onClick: () => navigate('/licensing') },
    { icon: UserPlus, label: 'Add Employee', color: 'var(--color-purple)', onClick: () => navigate('/hr') },
    { icon: Upload, label: 'Upload Document', color: 'var(--color-primary)', onClick: () => navigate('/documents') },
    { icon: FileSpreadsheet, label: 'Bulk Import', color: 'var(--color-orange)', onClick: onOpenImport },
    { icon: Search, label: 'Atlas AI', color: 'var(--color-tx)', onClick: () => setSearchOpen(true) },
    { icon: ClipboardCheck, label: 'Run Audit', color: 'var(--color-warning)', onClick: onOpenAudit },
  ];

  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          className="quick-action-btn"
          onClick={action.onClick}
        >
          <div className="quick-action-icon" style={{ color: action.color }}>
            <action.icon size={18} />
          </div>
          <span className="quick-action-label">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
