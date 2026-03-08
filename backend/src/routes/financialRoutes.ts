import { Router, type Router as ExpressRouter } from 'express';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { findUsuario } from '../controllers/authController';

const router: ExpressRouter = Router();

router.get('/financial/flows', async (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    const user = await findUsuario(userId || '', userEmail);
    const empresaId = user?.empresa ?? null;

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    let query = client
        .from('financial_flows')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false, nullsFirst: false })
        .range(from, to);

    if (empresaId !== null) {
        query = query.or(`idempresa.eq.${empresaId},empresa_id.eq.${empresaId}`);
    }

    const { data, error, count } = await query;

    if (error) {
        res.status(500).json({ error: 'Erro ao carregar lançamentos financeiros.' });
        return;
    }

    res.json({ data: data ?? [], total: count ?? 0, limit, page });
});

export default router;
