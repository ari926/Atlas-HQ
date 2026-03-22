import { create } from 'zustand';

interface StateFilterStore {
  activeState: string; // '' = All States
  setActiveState: (state: string) => void;
}

export const useStateFilter = create<StateFilterStore>((set) => {
  const saved = sessionStorage.getItem('hq-state-filter');
  return {
    activeState: saved || '',
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
