import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await fetchProfile(session.user.id);
        set({ session, user: session.user, profile, loading: false, initialized: true });
      } else {
        set({ session: null, user: null, profile: null, loading: false, initialized: true });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          const profile = await fetchProfile(session.user.id);
          set({ session, user: session.user, profile });
        } else {
          set({ session: null, user: null, profile: null });
        }
      });
    } catch (err) {
      console.error('[authStore] init error:', err);
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      return { error: error.message };
    }
    if (data.session) {
      const profile = await fetchProfile(data.session.user.id);
      set({ session: data.session, user: data.session.user, profile, loading: false });
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  setSession: (session: Session | null) => {
    set({ session, user: session?.user ?? null });
  },
}));

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .eq('id', userId)
      .single();
    return data;
  } catch {
    return null;
  }
}
