import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const isProduction = window.location.hostname === 'hq.talaria.com';

const SUPABASE_URL = isProduction
  ? 'https://buqopylxhqdiikzqctkb.supabase.co'
  : 'https://dutvbquoyjtoctjstbmv.supabase.co';

const SUPABASE_ANON_KEY = isProduction
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cW9weWx4aHFkaWlrenFjdGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4NjQ4NzQsImV4cCI6MjA1NjQ0MDg3NH0.z_GkFOoSJwieKOakNsZJllvfCVAFjXDixaJWO2fXBbY'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dHZicXVveWp0b2N0anN0Ym12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMzU5MDYsImV4cCI6MjA1NzkxMTkwNn0.CxEPNJdscGS1hl-f4fXMHAdz0S5pzmvCLXMwKnfKBvM';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'atlas-hq-auth-token',
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { isProduction };
