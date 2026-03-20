import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '../../stores/uiStore';
import { isProduction } from '../../lib/supabase';

export default function AppShell() {
  const { theme, sidebarOpen } = useUIStore();

  return (
    <div data-theme={theme}>
      {!isProduction && (
        <div className="dev-banner">DEV ENVIRONMENT</div>
      )}
      <div className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <Sidebar />
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
