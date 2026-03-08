import { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * Extrai o Bearer token do header Authorization.
 */
const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
    if (!authorizationHeader) {
        return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (!scheme || !token) {
        return null;
    }

    if (scheme.toLowerCase() !== 'bearer') {
        return null;
    }

    return token.trim() || null;
};

/**
 * Middleware de autenticação que valida o JWT do Supabase Auth.
 * Popula req.user com os dados do usuário autenticado e req.accessToken
 * com o token para criação de clientes user-scoped.
 */
export const authenticateRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
        res.status(401).json({ error: 'Token de autenticação ausente.' });
        return;
    }

    try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data.user) {
            res.status(401).json({ error: 'Token inválido ou expirado.' });
            return;
        }

        // Popula req.user e req.accessToken para uso nos controllers
        req.supabaseUser = data.user;
        req.accessToken = token;

        next();
    } catch (error) {
        console.error('Falha ao validar token de autenticação', error);
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
};
