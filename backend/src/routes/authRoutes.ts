import { Router, type Router as ExpressRouter } from 'express';
import { authenticateRequest } from '../middlewares/authMiddleware';
import {
    login,
    me,
    refresh,
    logout,
    requestPasswordReset,
    changePassword,
    register,
} from '../controllers/authController';

const router: ExpressRouter = Router();

// Rotas públicas
router.post('/auth/login', login);
router.post('/auth/register', register);
router.post('/auth/request-password-reset', requestPasswordReset);

// Rotas protegidas
router.get('/auth/me', authenticateRequest, me);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', authenticateRequest, logout);
router.post('/auth/change-password', authenticateRequest, changePassword);

export default router;
