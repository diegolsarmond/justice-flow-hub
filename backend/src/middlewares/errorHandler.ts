import { NextFunction, Request, Response } from 'express';

const errorHandler = (
    err: Error & { status?: number },
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const statusCode = err.status ?? 500;
    const message = statusCode === 500
        ? 'Erro interno do servidor.'
        : err.message || 'Erro desconhecido.';

    if (statusCode === 500) {
        console.error('Erro interno:', err);
    }

    res.status(statusCode).json({ error: message });
};

export default errorHandler;
