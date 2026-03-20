import { create } from 'zustand';

export type ViewMode = 'table' | 'kanban' | 'timeline' | 'dashboard';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  viewMode: ViewMode;
  searchOpen: boolean;
  detailTaskId: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchOpen: (open: boolean) => void;
  openDetail: (taskId: string) => void;
  closeDetail: () => void;
}

function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('atlas-hq-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: getInitialTheme(),
  viewMode: 'table',
  searchOpen: false,
  detailTaskId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('atlas-hq-theme', next); } catch { /* ignore */ }
      return { theme: next };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openDetail: (taskId) => set({ detailTaskId: taskId }),
  closeDetail: () => set({ detailTaskId: null }),
}));
