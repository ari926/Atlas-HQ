import { ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

interface Props {
  breadcrumb: BreadcrumbSegment[];
  onNavigate: (folderId: string) => void;
}

export default function BreadcrumbNav({ breadcrumb, onNavigate }: Props) {
  if (breadcrumb.length === 0) return null;

  return (
    <nav className="breadcrumb-nav">
      {breadcrumb.map((segment, i) => {
        const isLast = i === breadcrumb.length - 1;
        return (
          <span key={segment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {i > 0 && <ChevronRight size={12} className="breadcrumb-separator" />}
            <span
              className={`breadcrumb-item ${isLast ? 'current' : ''}`}
              onClick={isLast ? undefined : () => onNavigate(segment.id)}
            >
              {segment.name}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
