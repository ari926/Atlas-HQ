import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CreditCard, Users, FileText, Monitor } from 'lucide-react';

type Module = 'compliance' | 'licensing' | 'hr' | 'documents' | 'it-access';

interface Props {
  module: Module;
  label: string;
  recordId?: string;
  size?: 'sm' | 'md';
}

const MODULE_CONFIG: Record<Module, { icon: typeof ShieldCheck; route: string; color: string }> = {
  compliance: { icon: ShieldCheck, route: '/compliance', color: 'var(--color-success)' },
  licensing: { icon: CreditCard, route: '/licensing', color: 'var(--color-blue)' },
  hr: { icon: Users, route: '/hr', color: 'var(--color-purple)' },
  documents: { icon: FileText, route: '/documents', color: 'var(--color-primary)' },
  'it-access': { icon: Monitor, route: '/hr', color: 'var(--color-orange)' },
};

export default function RecordLink({ module, label, size = 'sm' }: Props) {
  const navigate = useNavigate();
  const config = MODULE_CONFIG[module];
  const Icon = config.icon;

  const isSm = size === 'sm';

  return (
    <button
      className="record-link"
      onClick={(e) => {
        e.stopPropagation();
        navigate(config.route);
      }}
      title={`Go to ${module}: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '0.25rem' : '0.375rem',
        padding: isSm ? '0.125rem 0.5rem' : '0.25rem 0.625rem',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${config.color}30`,
        background: `${config.color}10`,
        color: config.color,
        fontSize: isSm ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all var(--transition-interactive)',
        fontFamily: 'var(--font-family)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${config.color}20`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${config.color}50`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${config.color}10`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${config.color}30`;
      }}
    >
      <Icon size={isSm ? 10 : 12} />
      {label}
    </button>
  );
}
