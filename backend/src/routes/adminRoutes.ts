import { Router, type Router as ExpressRouter, Request, Response, NextFunction } from 'express';
import { findUsuario } from '../controllers/authController';
import { supabaseAdmin } from '../config/supabase';

type UsuarioAdminListItem = {
    id: number;
    nome_completo: string;
    email: string;
};

const normalizePerfilId = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const ensureAdminProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const supabaseUserId = req.supabaseUser?.id;
        const supabaseEmail = req.supabaseUser?.email ?? null;

        if (!supabaseUserId && !supabaseEmail) {
            res.status(401).json({ error: 'Usuário autenticado não encontrado.' });
            return;
        }

        const usuario = await findUsuario(supabaseUserId ?? '', supabaseEmail);

        if (!usuario) {
            res.status(403).json({ error: 'Usuário sem cadastro interno.' });
            return;
        }

        const perfilId = normalizePerfilId((usuario as { perfil_id?: unknown }).perfil_id ?? usuario.perfil);

        if (!perfilId) {
            res.status(403).json({ error: 'Acesso restrito a administradores.' });
            return;
        }

        const { data: perfilData, error: perfilError } = await supabaseAdmin
            .from('perfis')
            .select('id, nome')
            .eq('id', perfilId)
            .single();

        if (perfilError || !perfilData) {
            console.error('Erro ao validar perfil administrativo:', perfilError);
            res.status(403).json({ error: 'Acesso restrito a administradores.' });
            return;
        }

        const perfilNome = String(perfilData.nome ?? '').trim().toLowerCase();
        const isAdmin = perfilNome === 'administrador' || perfilNome === 'admin';

        if (!isAdmin) {
            res.status(403).json({ error: 'Acesso restrito a administradores.' });
            return;
        }

        next();
    } catch (error) {
        console.error('Erro ao validar autorização administrativa:', error);
        res.status(500).json({ error: 'Erro ao validar autorização administrativa.' });
    }
};

const adminRouter: ExpressRouter = Router();

adminRouter.get('/admin/users', ensureAdminProfile, async (_req: Request, res: Response): Promise<void> => {
    try {
        const { data, error } = await supabaseAdmin
            .from('usuarios')
            .select('id, nome_completo, email')
            .order('nome_completo', { ascending: true });

        if (error) {
            console.error('Erro ao listar usuários para administração:', error);
            res.status(500).json({ error: 'Erro ao listar usuários.' });
            return;
        }

        const users: UsuarioAdminListItem[] = (data ?? []).map((item) => ({
            id: Number(item.id),
            nome_completo: String(item.nome_completo ?? '').trim(),
            email: String(item.email ?? '').trim(),
        }));

        res.json(users);
    } catch (error) {
        console.error('Erro inesperado ao listar usuários para administração:', error);
        res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
});

export default adminRouter;
