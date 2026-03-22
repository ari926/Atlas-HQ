import { create } from 'zustand';

interface StateFilterStore {
  activeState: string | null; // null = All States
  setActiveState: (state: string | null) => void;
}

export const useStateFilter = create<StateFilterStore>((set) => {
  // Restore from sessionStorage
  const saved = sessionStorage.getItem('hq-state-filter');
  return {
    activeState: saved || null,
    setActiveState: (state) => {
      if (state) {
        sessionStorage.setItem('hq-state-filter', state);
      } else {
        sessionStorage.removeItem('hq-state-filter');
      }
      set({ activeState: state });
    },
  };
});
