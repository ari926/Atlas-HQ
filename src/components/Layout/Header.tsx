import { Search, Bell, Sun, Moon, Menu } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export default function Header() {
  const { theme, toggleTheme, toggleSidebar, setSearchOpen } = useUIStore();

  return (
    <header className="app-header">
      <button className="header-btn mobile-menu-btn" onClick={toggleSidebar}>
        <Menu size={18} />
      </button>

      <button className="header-search" onClick={() => setSearchOpen(true)}>
        <Search size={16} />
        <span className="header-search-text">Search...</span>
        <kbd className="header-search-kbd">&#8984;K</kbd>
      </button>

      <div className="header-spacer" />

      <button className="header-btn" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button className="header-btn" title="Notifications">
        <Bell size={18} />
      </button>
    </header>
  );
}
