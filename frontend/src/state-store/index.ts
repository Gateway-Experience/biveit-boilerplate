import { create } from 'zustand';

import type { User } from 'src/types/user';

// Global client state. Deliberately small — server data belongs in TanStack Query,
// this is for things the app itself owns.
type AppState = {
  user?: User | null;
  set: (partial: Partial<AppState>) => void;
};

const useStore = create<AppState>((set) => ({
  set,
}));

export {
  useStore,
};
