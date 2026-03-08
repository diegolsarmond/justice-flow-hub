import { Request, Response, Router, type Router as ExpressRouter } from 'express';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { findUsuario } from '../controllers/authController';
import { oportunidadeController } from '../controllers/oportunidadeController';

const router: ExpressRouter = Router();
const controller = oportunidadeController;

router.get('/oportunidades', controller.list);
router.get('/oportunidades/:id', controller.getById);
router.post('/oportunidades', controller.create);
router.put('/oportunidades/:id', controller.update);
router.delete('/oportunidades/:id', controller.remove);

const resolveOpportunityScope = async (req: Request, oportunidadeId: number) => {
    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    let empresaId: number | null = null;
    if (userId || userEmail) {
        const user = await findUsuario(userId || '', userEmail);
        empresaId = user?.empresa ?? (user as { empresa_id?: number | null } | null)?.empresa_id ?? null;
    }

    let opportunityQuery = client
        .from('oportunidades')
        .select('id, idempresa')
        .eq('id', oportunidadeId);

    if (empresaId != null) {
        opportunityQuery = opportunityQuery.eq('idempresa', empresaId);
    }

    const { data: oportunidade, error: oportunidadeError } = await opportunityQuery.maybeSingle();

    return { client, empresaId, oportunidade, oportunidadeError };
};

router.get('/oportunidades/:id/envolvidos', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para envolvidos:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        const { data, error } = await client
            .from('oportunidade_envolvidos')
            .select('*')
            .eq('oportunidade_id', oportunidadeId)
            .order('id', { ascending: true });

        if (error) {
            console.error('[Oportunidade] Erro ao buscar envolvidos:', error);
            res.status(500).json({ error: 'Erro ao buscar envolvidos.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao buscar envolvidos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar envolvidos.' });
    }
});

router.get('/oportunidades/:id/parcelas', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError, empresaId } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para parcelas:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        let parcelasQuery = client
            .from('oportunidade_parcelas')
            .select('*')
            .eq('oportunidade_id', oportunidadeId)
            .order('numero_parcela', { ascending: true });

        if (empresaId != null) {
            parcelasQuery = parcelasQuery.eq('idempresa', empresaId);
        }

        const { data, error } = await parcelasQuery;

        if (error) {
            console.error('[Oportunidade] Erro ao buscar parcelas:', error);
            res.status(500).json({ error: 'Erro ao buscar parcelas.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao buscar parcelas:', error);
        res.status(500).json({ error: 'Erro interno ao buscar parcelas.' });
    }
});

router.get('/oportunidades/:id/faturamentos', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para faturamentos:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        const { data, error } = await client
            .from('oportunidade_faturamentos')
            .select('*')
            .eq('oportunidade_id', oportunidadeId)
            .order('criado_em', { ascending: false });

        if (error) {
            console.error('[Oportunidade] Erro ao buscar faturamentos:', error);
            res.status(500).json({ error: 'Erro ao buscar faturamentos.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao buscar faturamentos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar faturamentos.' });
    }
});

router.post('/oportunidades/:id/faturamentos', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError, empresaId } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para criar faturamento:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        const payload = {
            oportunidade_id: oportunidadeId,
            forma_pagamento: req.body?.forma_pagamento ?? 'Pix',
            condicao_pagamento: req.body?.condicao_pagamento ?? null,
            valor: req.body?.valor ?? null,
            parcelas: req.body?.parcelas ?? null,
            observacoes: req.body?.observacoes ?? null,
            data_faturamento: req.body?.data_faturamento ?? null,
        };

        const { data: created, error: createError } = await client
            .from('oportunidade_faturamentos')
            .insert(payload)
            .select('*')
            .single();

        if (createError) {
            console.error('[Oportunidade] Erro ao criar faturamento:', createError);
            res.status(500).json({ error: 'Erro ao criar faturamento.' });
            return;
        }

        const parcelasIds = Array.isArray(req.body?.parcelas_ids)
            ? req.body.parcelas_ids
                .map((id: unknown) => Number.parseInt(String(id), 10))
                .filter((id: number) => Number.isFinite(id))
            : [];

        if (parcelasIds.length > 0) {
            let parcelasUpdate = client
                .from('oportunidade_parcelas')
                .update({
                    faturamento_id: (created as { id: number }).id,
                    status: 'pago',
                    quitado_em: new Date().toISOString(),
                })
                .eq('oportunidade_id', oportunidadeId)
                .in('id', parcelasIds);

            if (empresaId != null) {
                parcelasUpdate = parcelasUpdate.eq('idempresa', empresaId);
            }

            const { error: parcelasError } = await parcelasUpdate;
            if (parcelasError) {
                console.error('[Oportunidade] Erro ao atualizar parcelas do faturamento:', parcelasError);
            }
        }

        res.status(201).json(created);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao criar faturamento:', error);
        res.status(500).json({ error: 'Erro interno ao criar faturamento.' });
    }
});

router.get('/oportunidades/:id/documentos', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para documentos:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        const { data, error } = await client
            .from('oportunidade_documentos')
            .select('*')
            .eq('oportunidade_id', oportunidadeId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Oportunidade] Erro ao buscar documentos:', error);
            res.status(500).json({ error: 'Erro ao buscar documentos.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao buscar documentos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar documentos.' });
    }
});

router.post('/oportunidades/:id/documentos', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(oportunidadeId)) {
        res.status(400).json({ error: 'ID de oportunidade inválido.' });
        return;
    }

    try {
        const { client, oportunidade, oportunidadeError } = await resolveOpportunityScope(req, oportunidadeId);

        if (oportunidadeError) {
            console.error('[Oportunidade] Erro ao validar oportunidade para criar documento:', oportunidadeError);
            res.status(500).json({ error: 'Erro ao validar oportunidade.' });
            return;
        }

        if (!oportunidade) {
            res.status(404).json({ error: 'Oportunidade não encontrada.' });
            return;
        }

        const title = typeof req.body?.title === 'string' && req.body.title.trim().length > 0
            ? req.body.title.trim()
            : 'Documento';

        const payload = {
            oportunidade_id: oportunidadeId,
            template_id: req.body?.template_id ?? req.body?.templateId ?? null,
            title,
            content: req.body?.content_html ?? '<p></p>',
            variables: req.body?.content_editor_json ?? {},
        };

        const { data, error } = await client
            .from('oportunidade_documentos')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
            console.error('[Oportunidade] Erro ao criar documento:', error);
            res.status(500).json({ error: 'Erro ao criar documento.' });
            return;
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao criar documento:', error);
        res.status(500).json({ error: 'Erro interno ao criar documento.' });
    }
});

router.get('/oportunidades/:id/documentos/:documentId', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    const documentId = Number.parseInt(req.params.documentId, 10);

    if (!Number.isFinite(oportunidadeId) || !Number.isFinite(documentId)) {
        res.status(400).json({ error: 'Parâmetros inválidos.' });
        return;
    }

    try {
        const { client } = await resolveOpportunityScope(req, oportunidadeId);
        const { data, error } = await client
            .from('oportunidade_documentos')
            .select('*')
            .eq('id', documentId)
            .eq('oportunidade_id', oportunidadeId)
            .maybeSingle();

        if (error) {
            console.error('[Oportunidade] Erro ao buscar documento:', error);
            res.status(500).json({ error: 'Erro ao buscar documento.' });
            return;
        }

        if (!data) {
            res.status(404).json({ error: 'Documento não encontrado.' });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao buscar documento:', error);
        res.status(500).json({ error: 'Erro interno ao buscar documento.' });
    }
});

router.put('/oportunidades/:id/documentos/:documentId', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    const documentId = Number.parseInt(req.params.documentId, 10);

    if (!Number.isFinite(oportunidadeId) || !Number.isFinite(documentId)) {
        res.status(400).json({ error: 'Parâmetros inválidos.' });
        return;
    }

    try {
        const { client } = await resolveOpportunityScope(req, oportunidadeId);
        const updatePayload: Record<string, unknown> = {};

        if (typeof req.body?.title === 'string' && req.body.title.trim().length > 0) {
            updatePayload.title = req.body.title.trim();
        }

        if (typeof req.body?.content_html === 'string') {
            updatePayload.content = req.body.content_html;
        }

        if (req.body?.content_editor_json !== undefined) {
            updatePayload.variables = req.body.content_editor_json;
        }

        const { data, error } = await client
            .from('oportunidade_documentos')
            .update(updatePayload)
            .eq('id', documentId)
            .eq('oportunidade_id', oportunidadeId)
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('[Oportunidade] Erro ao atualizar documento:', error);
            res.status(500).json({ error: 'Erro ao atualizar documento.' });
            return;
        }

        if (!data) {
            res.status(404).json({ error: 'Documento não encontrado.' });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao atualizar documento:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar documento.' });
    }
});

router.delete('/oportunidades/:id/documentos/:documentId', async (req: Request, res: Response) => {
    const oportunidadeId = Number.parseInt(req.params.id, 10);
    const documentId = Number.parseInt(req.params.documentId, 10);

    if (!Number.isFinite(oportunidadeId) || !Number.isFinite(documentId)) {
        res.status(400).json({ error: 'Parâmetros inválidos.' });
        return;
    }

    try {
        const { client } = await resolveOpportunityScope(req, oportunidadeId);

        const { error } = await client
            .from('oportunidade_documentos')
            .delete()
            .eq('id', documentId)
            .eq('oportunidade_id', oportunidadeId);

        if (error) {
            console.error('[Oportunidade] Erro ao excluir documento:', error);
            res.status(500).json({ error: 'Erro ao excluir documento.' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        console.error('[Oportunidade] Erro interno ao excluir documento:', error);
        res.status(500).json({ error: 'Erro interno ao excluir documento.' });
    }
});

export default router;
