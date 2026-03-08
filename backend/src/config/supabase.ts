import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error('SUPABASE_URL não está definido no .env');
}

if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY não está definido no .env');
}

if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está definido no .env');
}

if (supabaseServiceRoleKey === supabaseAnonKey) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[CRITICAL SEVERE WARNING] SUPABASE_SERVICE_ROLE_KEY IS IDENTICAL TO SUPABASE_ANON_KEY');
    console.error('SERVER-SIDE OPERATIONS WILL BE RESTRICTED BY RLS AND FAIL SILENTLY (0 ROWS RETURNED)');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
} else {
    console.log('[SUPABASE CONFIG] Validated: Service Role Key is distinct from Anon Key.');
}

/**
 * Cliente Supabase "anon" — respeita RLS, usado para criar clientes
 * autenticados com o token do usuário.
 */
export const supabaseAnon: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});

/**
 * Cliente Supabase "service_role" — ignora RLS, usado pelo servidor
 * para operações administrativas (ex: criar usuários, queries internas).
 * NUNCA expor este cliente ao frontend.
 */
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});

/**
 * Cria um cliente Supabase autenticado com o token JWT do usuário.
 * Usado nas rotas protegidas para que as queries respeitem RLS.
 */
export function createUserClient(accessToken: string): SupabaseClient {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}

export { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
