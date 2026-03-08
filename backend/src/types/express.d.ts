import { User } from '@supabase/supabase-js';

declare global {
    namespace Express {
        interface Request {
            /** Usuário autenticado via Supabase Auth */
            supabaseUser?: User;
            /** Access token JWT do Supabase (para criar clientes user-scoped) */
            accessToken?: string;
        }
    }
}

export { };
