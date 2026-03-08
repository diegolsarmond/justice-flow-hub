import { createClient } from '@supabase/supabase-js';

// Lovable Cloud Supabase
const supabaseUrl = 'https://duqqnwmbbkaqewtvirmo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1cXFud21iYmthcWV3dHZpcm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDkzNjAsImV4cCI6MjA4NjgyNTM2MH0.O2x9n_NSezUv2Hg_Up4B5rgnUhqsKQ2LfSNSAG2lX-A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'jus-connect:supabase-auth',
    },
});

export { supabaseUrl, supabaseAnonKey };
