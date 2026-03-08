

import './utils/loadEnv'; // Carrega variáveis de ambiente ANTES de qualquer outro import
import path from 'path';
import express from 'express';
import cors from 'cors';

import entityRoutes, { publicEntityRoutes } from './routes/entityRoutes';
import authRouter from './routes/authRoutes';
import stubRouter from './routes/stubRoutes';
import chatRouter from './routes/chatRoutes';
import dashboardRouter from './routes/dashboardRoutes';
import empresaRouter from './routes/empresaRoutes';
import clienteRouter from './routes/clienteRoutes';
import usuarioRouter from './routes/usuarioRoutes';
import { authenticateRequest } from './middlewares/authMiddleware';
import processoRoutes from './routes/processoRoutes';
import oportunidadeRoutes from './routes/oportunidadeRoutes';
import billingSiteRoutes from './routes/billingSiteRoutes';
import adminRoutes from './routes/adminRoutes';
import financialRoutes from './routes/financialRoutes';

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
// Middlewares
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['x-total-count']
}));
app.use(express.json());

// Logger de requisições simples para debug
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Rotas Estáticas / Públicas
app.use('/api', publicEntityRoutes);
app.use('/api', authRouter); // /api/auth/login etc... authRouter já tem prefixo /auth
app.use('/api', billingSiteRoutes);

// Rotas Protegidas (Entity Routes)
app.use('/api', authenticateRequest, entityRoutes); // Mover para o topo para garantir precedência de rotas específicas
app.use('/api', authenticateRequest, chatRouter);
app.use('/api', authenticateRequest, stubRouter);
app.use('/api', authenticateRequest, dashboardRouter);
app.use('/api', authenticateRequest, empresaRouter);
app.use('/api', authenticateRequest, clienteRouter);
app.use('/api', authenticateRequest, usuarioRouter);
app.use('/api', authenticateRequest, processoRoutes);
app.use('/api', authenticateRequest, oportunidadeRoutes);
app.use('/api', authenticateRequest, adminRoutes);
app.use('/api', authenticateRequest, financialRoutes);

// Ensure API 404s don't fall through to frontend routing
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, '../../frontend/dist');
    
    app.use(express.static(frontendDistPath));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}


// Rota de Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tratamento de erros global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Erro global:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(port, () => {
    console.log(`Backend rodando na porta ${port}`);

    // Inicia o agendador de sincronização de processos
    import('./services/processosScheduler').then(({ startProcessosScheduler }) => {
        startProcessosScheduler();
    }).catch((err) => {
        console.error('[index] Erro ao iniciar processos scheduler:', err);
    });
});
