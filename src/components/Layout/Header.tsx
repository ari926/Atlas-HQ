import { Search, Bell, Sun, Moon, Menu, MapPin } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useStateFilter } from '../../stores/stateFilterStore';

const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV', 'UT', 'NV'];

export default function Header() {
  const { theme, toggleTheme, toggleSidebar, setSearchOpen } = useUIStore();
  const { activeState, setActiveState } = useStateFilter();

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

      {/* Global State Filter */}
      <div className="state-filter">
        <MapPin size={14} />
        <select
          value={activeState}
          onChange={(e) => setActiveState(e.target.value)}
          className="state-filter-select"
        >
          <option value="">All States</option>
          {STATES.map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <button className="header-btn" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button className="header-btn" title="Notifications">
        <Bell size={18} />
      </button>
    </header>
  );
}
