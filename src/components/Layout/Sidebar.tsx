import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  ShieldCheck,
  CreditCard,
  Users,
  FolderOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { getInitials } from '../../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: Table2, label: 'Projects' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
  { to: '/licensing', icon: CreditCard, label: 'Licensing' },
  { to: '/hr', icon: Users, label: 'HR' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
];

export default function Sidebar() {
  const { profile, user, signOut } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const displayName = profile?.full_name || user?.email || 'User';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
          <rect width="28" height="28" rx="7" fill="var(--color-primary)" />
          <path d="M9 9h10v2h-3.5v8H12.5V11H9V9z" fill="white" />
          <path d="M7 12c-1 1-1.5 2.5-1.5 4s.5 3 1.5 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M21 12c1 1 1.5 2.5 1.5 4s-.5 3-1.5 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
        </svg>
        <span className="sidebar-brand-text">Atlas HQ</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        className="sidebar-collapse-btn"
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.5rem 1rem', margin: '0 0.5rem 0.25rem',
          background: 'none', border: 'none', borderRadius: 'var(--radius-md)',
          color: 'var(--color-tx-faint)', cursor: 'pointer', fontSize: '0.75rem',
          transition: 'all 0.15s ease', maxWidth: 'calc(100% - 1rem)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-offset)'; e.currentTarget.style.color = 'var(--color-tx-muted)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-tx-faint)'; }}
      >
        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        <span>Collapse</span>
      </button>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{getInitials(displayName)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName}</div>
          </div>
          <button className="sidebar-logout" onClick={signOut} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
