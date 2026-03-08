import { Request, Response } from 'express';
import { supabaseAdmin, createUserClient } from '../config/supabase';
import { findUsuario } from './authController';

// ─── CRUD Genérico Supabase ──────────────────────────────────────────────────

/**
 * Cria um controller CRUD genérico para uma tabela Supabase.
 * Filtra automaticamente por empresa do usuário quando a tabela possui esse campo.
 *
 * @param tableName   Nome REAL da tabela no Supabase (ex: 'area_atuacao')
 * @param options.empresaColumn  Nome da coluna FK-empresa na tabela (ex: 'idempresa', 'empresa').
 *                               Se não informado e filterByEmpresa=true, assume 'idempresa'.
 * @param options.empresaColumns Lista de colunas candidatas para filtro por empresa
 *                               (ex: ['idempresa', 'empresa_id']) em tabelas legadas.
 */
export function createCrudController(tableName: string, options?: {
    filterByEmpresa?: boolean;
    empresaColumn?: string;
    empresaFilterColumns?: string[];
    empresaColumns?: string[];
    selectFields?: string;
    searchFields?: string[];
    orderBy?: string;
    orderAscending?: boolean;
    orderNullsFirst?: boolean;
    countType?: 'exact' | 'planned' | 'estimated';
    normalizeInput?: (payload: Record<string, unknown>) => Record<string, unknown>;
    normalizeOutput?: (record: any) => any;
}) {
    const {
        filterByEmpresa = true,
        empresaColumn = 'idempresa',
        empresaFilterColumns = [],
        empresaColumns: configuredEmpresaColumns = [empresaColumn],
        empresaColumns: _empresaColumnsOption = [empresaColumn],
        selectFields = '*',
        searchFields = [],
        orderBy = 'id',
        orderAscending = true,
        orderNullsFirst,
        countType = 'exact',
        normalizeInput,
        normalizeOutput,
    } = options ?? {};

    const empresaColumns = [empresaColumn, ...empresaFilterColumns.filter((column) => column && column !== empresaColumn), ...configuredEmpresaColumns.filter((column) => column && column !== empresaColumn)];

    const normalizeRecord = <T = any>(record: T): T => {
        if (!normalizeOutput) {
            return record;
        }

        return normalizeOutput(record) as T;
    };
    const uniqueEmpresaColumns = Array.from(new Set(
        empresaColumns
            .filter((column): column is string => typeof column === 'string' && column.trim().length > 0)
            .map(column => column.trim()),
    ));

    const activeEmpresaColumns = uniqueEmpresaColumns.length > 0 ? uniqueEmpresaColumns : [empresaColumn];

    function applyEmpresaFilter<T>(query: T, empresaId: number): T {
        if (activeEmpresaColumns.length === 1) {
            return (query as { eq: (column: string, value: number) => T }).eq(activeEmpresaColumns[0], empresaId);
        }

        const orConditions = activeEmpresaColumns.map(column => `${column}.eq.${empresaId}`).join(',');

        return (query as { or: (filters: string) => T }).or(orConditions);
    }

    function populateEmpresaColumns(body: Record<string, unknown>, empresaId: number): void {
        activeEmpresaColumns.forEach((column) => {
            if (body[column] === undefined || body[column] === null || body[column] === '') {
                body[column] = empresaId;
            }
        });
    }

    /**
     * Busca o id da empresa do usuário autenticado.
     * Na tabela `usuarios`, a FK para empresa é a coluna `empresa` (int4).
     */
    async function getEmpresaId(req: Request): Promise<number | null> {
        if (!filterByEmpresa) return null;

        const userId = req.supabaseUser?.id;
        const userEmail = req.supabaseUser?.email;
        if (!userId && !userEmail) return null;

        try {
            const user = await findUsuario(userId || '', userEmail);
            return (user?.empresa ?? (user as any)?.empresa_id ?? null) as number | null;
        } catch (error) {
            console.error('Erro ao buscar usuário em getEmpresaId:', error);
            return null;
        }
    }

    /**
     * GET / — Lista todos os registros (com paginação e busca).
     */
    async function list(req: Request, res: Response): Promise<void> {
        try {
            const accessToken = req.accessToken;
            const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
            const empresaId = await getEmpresaId(req);


            const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
            const requestedLimit =
                parseInt(req.query.limit as string, 10)
                || parseInt(req.query.pageSize as string, 10)
                || 20;
            const limit = Math.min(10000, Math.max(1, requestedLimit));
            const offset = (page - 1) * limit;
            const search = (req.query.search as string || '').trim();

            let query = client.from(tableName).select(selectFields, { count: countType });

            if (empresaId !== null) {
                query = applyEmpresaFilter(query, empresaId);
            }

            // Busca textual
            if (search && searchFields.length > 0) {
                const orConditions = searchFields.map(field => `${field}.ilike.%${search}%`).join(',');
                query = query.or(orConditions);
            }

            // Filtros adicionais via query params
            for (const [key, value] of Object.entries(req.query)) {
                if (['page', 'limit', 'pageSize', 'search', 'order', 'orderDirection'].includes(key)) continue;
                if (typeof value === 'string' && value.trim()) {
                    if (value === 'null') {
                        query = query.is(key, null);
                    } else if (value === 'not_null') {
                        query = query.not(key, 'is', null);
                    } else {
                        query = query.eq(key, value);
                    }
                }
            }

            // Ordenação
            const sortField = (req.query.order as string) || orderBy;
            const sortAsc = req.query.orderDirection === 'desc' ? false : orderAscending;
            query = query.order(sortField, { ascending: sortAsc, nullsFirst: orderNullsFirst });

            // Paginação
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;


            if (error) {
                console.error(`Erro ao listar ${tableName}:`, error);
                res.status(500).json({ error: `Erro ao listar ${tableName}.` });
                return;
            }

            res.json({
                data: (data ?? []).map((record) => normalizeRecord(record)),
                total: count ?? 0,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
            });
        } catch (error) {
            console.error(`Erro ao listar ${tableName}:`, error);
            res.status(500).json({ error: `Erro interno ao listar ${tableName}.` });
        }
    }

    /**
     * GET /:id — Busca um registro por ID.
     */
    async function getById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken;
            const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
            const empresaId = await getEmpresaId(req);

            let query = client.from(tableName).select(selectFields).eq('id', id);

            if (empresaId !== null) {
                query = applyEmpresaFilter(query, empresaId);
            }

            const { data, error } = await query.single();

            if (error || !data) {
                if (error && error.code !== 'PGRST116') { // PGRST116 é o erro de single() vazio
                    console.error(`[CRUD][${tableName}] Erro ao buscar por ID ${id}:`, error);
                } else if (!data) {
                    console.warn(`[CRUD][${tableName}] Registro com ID ${id} não encontrado.`);
                }
                res.status(404).json({ error: 'Registro não encontrado.' });
                return;
            }

            res.json(normalizeRecord(data));
        } catch (error) {
            console.error(`[CRUD][${tableName}] Erro interno ao buscar ID ${req.params.id}:`, error);
            res.status(500).json({ error: `Erro interno ao buscar ${tableName}.` });
        }
    }

    /**
     * POST / — Cria um novo registro.
     */
    async function create(req: Request, res: Response): Promise<void> {
        try {
            const accessToken = req.accessToken!;
            const client = createUserClient(accessToken);
            const empresaId = await getEmpresaId(req);

            const payload = normalizeInput ? normalizeInput(req.body ?? {}) : (req.body ?? {});
            const body = { ...payload };

            if (filterByEmpresa && empresaId !== null) {
                populateEmpresaColumns(body, empresaId);
            }

            const { data, error } = await client
                .from(tableName)
                .insert(body)
                .select(selectFields)
                .single();

            if (error) {
                console.error(`Erro ao criar ${tableName}:`, error);
                res.status(400).json({ error: error.message || `Erro ao criar ${tableName}.` });
                return;
            }

            res.status(201).json(normalizeRecord(data));
        } catch (error) {
            console.error(`Erro ao criar ${tableName}:`, error);
            res.status(500).json({ error: `Erro interno ao criar ${tableName}.` });
        }
    }

    /**
     * PUT /:id — Atualiza um registro existente.
     */
    async function update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken!;
            const client = createUserClient(accessToken);
            const empresaId = await getEmpresaId(req);

            const payload = normalizeInput ? normalizeInput(req.body ?? {}) : (req.body ?? {});

            let query = client.from(tableName).update(payload).eq('id', id);

            if (empresaId !== null) {
                query = applyEmpresaFilter(query, empresaId);
            }

            const { data, error } = await query.select(selectFields).single();

            if (error) {
                console.error(`Erro ao atualizar ${tableName}:`, error);
                res.status(400).json({ error: error.message || `Erro ao atualizar ${tableName}.` });
                return;
            }

            if (!data) {
                res.status(404).json({ error: 'Registro não encontrado.' });
                return;
            }

            res.json(normalizeRecord(data));
        } catch (error) {
            console.error(`Erro ao atualizar ${tableName}:`, error);
            res.status(500).json({ error: `Erro interno ao atualizar ${tableName}.` });
        }
    }

    /**
     * DELETE /:id — Remove um registro.
     */
    async function remove(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const accessToken = req.accessToken!;
            const client = createUserClient(accessToken);
            const empresaId = await getEmpresaId(req);

            let query = client.from(tableName).delete().eq('id', id);

            if (empresaId !== null) {
                query = applyEmpresaFilter(query, empresaId);
            }

            const { error } = await query;

            if (error) {
                console.error(`Erro ao remover ${tableName}:`, error);
                res.status(400).json({ error: error.message || `Erro ao remover ${tableName}.` });
                return;
            }

            res.status(204).send();
        } catch (error) {
            console.error(`Erro ao remover ${tableName}:`, error);
            res.status(500).json({ error: `Erro interno ao remover ${tableName}.` });
        }
    }

    return { list, getById, create, update, remove };
}
