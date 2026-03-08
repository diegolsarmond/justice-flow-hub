// Re-export the auto-generated Supabase client to avoid duplication
export { supabase } from '@/integrations/supabase/client';

// Export URL and key for any code that needs them directly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export { supabaseUrl, supabaseAnonKey };
