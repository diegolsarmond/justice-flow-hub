import { Request, Response, Router, type Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

const EDGE_FUNCTION_NAME = 'uazapi-proxy';
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

interface EdgeInvokeOptions {
    action: string;
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined | null>;
    body?: unknown;
}

const asTrimmedString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const parseOptionalInt = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const parseEdgePayload = async (response: globalThis.Response): Promise<unknown> => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.toLowerCase().includes('application/json')) {
        return response.json();
    }
    const text = await response.text();
    return text ? { message: text } : {};
};

const invokeEdge = async (req: Request, options: EdgeInvokeOptions): Promise<{ status: number; payload: unknown }> => {
    if (!supabaseUrl) {
        return { status: 500, payload: { error: 'SUPABASE_URL não está definido no backend.' } };
    }

    if (!req.accessToken) {
        return { status: 401, payload: { error: 'Token de autenticação ausente.' } };
    }

    const url = new URL(`${supabaseUrl}/functions/v1/${EDGE_FUNCTION_NAME}`);
    url.searchParams.set('action', options.action);

    if (options.query) {
        for (const [key, value] of Object.entries(options.query)) {
            if (value === undefined || value === null) continue;
            const stringValue = String(value).trim();
            if (!stringValue) continue;
            url.searchParams.set(key, stringValue);
        }
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${req.accessToken}`,
        Accept: 'application/json',
    };

    if (supabaseAnonKey) {
        headers.apikey = supabaseAnonKey;
    }

    if (options.method === 'POST') {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
    });

    const payload = await parseEdgePayload(response);
    return { status: response.status, payload };
};

const asObject = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const toBoolean = (value: unknown): boolean => value === true;

const mapMessageStatus = (value: unknown): 'pending' | 'sent' | 'delivered' | 'read' | 'failed' => {
    if (typeof value !== 'string') return 'sent';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'pending') return 'pending';
    if (normalized === 'delivered') return 'delivered';
    if (normalized === 'read') return 'read';
    if (normalized === 'failed') return 'failed';
    return 'sent';
};

const mapMessageType = (value: unknown): string => {
    if (typeof value !== 'string') return 'text';
    const normalized = value.trim().toLowerCase();
    return normalized || 'text';
};

const mapConversation = (row: unknown): Record<string, unknown> => {
    const item = asObject(row);
    const id = asTrimmedString(item.id) ?? '';
    const lastMessageText = asTrimmedString(item.last_message_text) ?? '';
    const lastMessageAt = asTrimmedString(item.last_message_at) ?? asTrimmedString(item.updated_at) ?? new Date().toISOString();

    return {
        id,
        name: asTrimmedString(item.contact_name) ?? asTrimmedString(item.name) ?? 'Contato',
        avatar: asTrimmedString(item.contact_image) ?? asTrimmedString(item.avatar) ?? '',
        shortStatus: asTrimmedString(item.status) ?? 'online',
        unreadCount: typeof item.unread_count === 'number' ? item.unread_count : 0,
        pinned: toBoolean(item.pinned) || toBoolean(item.is_pinned),
        muted: toBoolean(item.muted) || toBoolean(item.is_muted),
        archived: toBoolean(item.archived) || toBoolean(item.is_archived),
        phoneNumber: asTrimmedString(item.contact_phone),
        description: asTrimmedString(item.last_message_text),
        lastMessage: lastMessageText
            ? {
                id: `last-${id}`,
                sender: 'contact',
                content: lastMessageText,
                preview: lastMessageText,
                timestamp: lastMessageAt,
                status: 'delivered',
                type: 'text',
            }
            : undefined,
    };
};

const mapMessage = (row: unknown): Record<string, unknown> => {
    const item = asObject(row);

    return {
        id: asTrimmedString(item.id) ?? asTrimmedString(item.wa_message_id) ?? crypto.randomUUID(),
        conversationId: asTrimmedString(item.conversation_id) ?? asTrimmedString(item.conversationId) ?? '',
        sender: item.from_me === true ? 'me' : 'contact',
        content: asTrimmedString(item.content) ?? '',
        timestamp:
            asTrimmedString(item.created_at) ??
            asTrimmedString(item.updated_at) ??
            asTrimmedString(item.timestamp) ??
            new Date().toISOString(),
        status: mapMessageStatus(item.status),
        reaction: asTrimmedString(item.reaction),
        type: mapMessageType(item.message_type ?? item.type),
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
    };
};

const resolvePreferredInstanceId = async (req: Request): Promise<string | null> => {
    const result = await invokeEdge(req, { action: 'list-instances' });
    if (result.status >= 400) {
        return null;
    }

    const payload = asObject(result.payload);
    const instances = Array.isArray(payload.instances) ? payload.instances : [];
    const normalized = instances
        .map((entry) => asObject(entry))
        .filter((entry) => typeof entry.id === 'string' && entry.id.trim().length > 0);

    if (normalized.length === 0) {
        return null;
    }

    const connected = normalized.find((entry) => asTrimmedString(entry.status) === 'connected');
    return asTrimmedString((connected ?? normalized[0] ?? {}).id);
};

router.get('/conversations', async (req: Request, res: Response) => {
    const limit = parseOptionalInt(req.query.limit) ?? 25;
    const offset = parseOptionalInt(req.query.offset) ?? 0;
    const search = asTrimmedString(req.query.search) ?? asTrimmedString(req.query.operator) ?? '';

    const instanceId = asTrimmedString(req.query.instanceId) ?? await resolvePreferredInstanceId(req);

    if (!instanceId) {
        res.status(200).json({ chats: [], total: 0, hasMore: false, message: 'Nenhuma instância conectada para listar conversas.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'list-chats',
        query: { instanceId, limit, offset, search },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
    const chats = conversations.map(mapConversation);

    res.status(200).json({
        chats,
        total: offset + chats.length,
        hasMore: payload.hasMore === true,
        limit,
        offset,
        synced: payload.synced,
    });
});

router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.params.conversationId);
    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para carregar mensagens.' });
        return;
    }

    const limit = parseOptionalInt(req.query.limit) ?? 20;
    const offset = parseOptionalInt(req.query.offset) ?? 0;

    const result = await invokeEdge(req, {
        action: 'list-messages',
        query: { conversationId, limit, offset },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const messages = Array.isArray(payload.messages) ? payload.messages.map(mapMessage) : [];

    res.status(200).json({ messages, nextCursor: null, nextOffset: offset + messages.length, hasMore: payload.hasMore === true });
});

router.post('/conversations/providers/uaz/sync', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.body?.conversationId);
    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para sincronizar mensagens.' });
        return;
    }

    const limit = parseOptionalInt(req.body?.limit) ?? 20;
    const offset = parseOptionalInt(req.body?.offset) ?? 0;

    const result = await invokeEdge(req, {
        action: 'list-messages',
        query: { conversationId, limit, offset },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const messages = Array.isArray(payload.messages) ? payload.messages.map(mapMessage) : [];

    res.status(200).json({ messages, nextCursor: null, nextOffset: offset + messages.length, hasMore: payload.hasMore === true });
});

router.post('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.params.conversationId);
    const content = asTrimmedString(req.body?.content);

    if (!conversationId || !content) {
        res.status(400).json({ message: 'conversationId e content são obrigatórios para enviar mensagem.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'send-message',
        method: 'POST',
        body: {
            conversationId,
            text: content,
            type: asTrimmedString(req.body?.type) ?? 'text',
            isPrivate: req.body?.isPrivate === true,
        },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const message = payload.message ? mapMessage(payload.message) : { id: crypto.randomUUID(), conversationId, sender: 'me', content, timestamp: new Date().toISOString(), status: 'sent', type: 'text' };

    res.status(200).json(message);
});

router.post('/conversations/:conversationId/read', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.params.conversationId);

    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para marcar conversa como lida.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'mark-messages-read',
        method: 'POST',
        body: { conversationId },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ success: true, conversationId });
});

router.post('/conversations/:conversationId/typing', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.params.conversationId);
    const isTyping = req.body?.isTyping === true;

    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para atualizar estado de digitação.' });
        return;
    }

    // Endpoint de compatibilidade para o frontend.
    // UAZAPI não exige este estado para envio de mensagens no momento.
    res.status(200).json({ success: true, conversationId, isTyping });
});

router.get('/conversations/:conversationId/avatar', async (req: Request, res: Response) => {
    const avatarUrl = asTrimmedString(req.query.url);
    if (!avatarUrl || (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
        res.status(204).send();
        return;
    }

    try {
        const avatarResponse = await fetch(avatarUrl);
        if (!avatarResponse.ok) {
            res.status(204).send();
            return;
        }

        const contentType = avatarResponse.headers.get('content-type') ?? 'application/octet-stream';
        const buffer = Buffer.from(await avatarResponse.arrayBuffer());
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(buffer);
    } catch (_error) {
        res.status(204).send();
    }
});

router.post('/message/reaction', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.body?.conversationId);
    const messageId = asTrimmedString(req.body?.messageId);
    const reaction = asTrimmedString(req.body?.reaction);

    if (!conversationId || !messageId || !reaction) {
        res.status(400).json({ message: 'conversationId, messageId e reaction são obrigatórios.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'react-message',
        method: 'POST',
        body: { conversationId, messageId, emoji: reaction },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ id: messageId, conversationId, sender: 'me', content: '', timestamp: new Date().toISOString(), status: 'sent', reaction, type: 'text' });
});

router.post('/message/edit', async (req: Request, res: Response) => {
    const messageId = asTrimmedString(req.body?.messageId);
    const content = asTrimmedString(req.body?.content);
    const instanceId = asTrimmedString(req.body?.instanceId) ?? await resolvePreferredInstanceId(req);

    if (!messageId || !content || !instanceId) {
        res.status(400).json({ message: 'messageId, content e instância ativa são obrigatórios para editar mensagem.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'edit-message',
        method: 'POST',
        query: { instanceId },
        body: { messageId, text: content },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ id: messageId, content, timestamp: new Date().toISOString(), status: 'sent', type: 'text' });
});

router.post('/chat/mute', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.body?.conversationId);
    const muted = req.body?.muted === true;

    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para silenciar conversa.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'mute-chat',
        method: 'POST',
        body: { conversationId, muteEndTime: muted ? -1 : 0 },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ id: conversationId, muted });
});

router.post('/chat/archive', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.body?.conversationId);
    const archived = req.body?.archived === true;

    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para arquivar conversa.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'archive-chat',
        method: 'POST',
        body: { conversationId, archive: archived },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ id: conversationId, archived });
});

router.post('/chat/pin', async (req: Request, res: Response) => {
    const conversationId = asTrimmedString(req.body?.conversationId);
    const pinned = req.body?.pinned === true;

    if (!conversationId) {
        res.status(400).json({ message: 'conversationId é obrigatório para fixar conversa.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'pin-chat',
        method: 'POST',
        body: { conversationId, pin: pinned },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    res.status(200).json({ id: conversationId, pinned });
});

router.get('/contacts', async (req: Request, res: Response) => {
    const limit = parseOptionalInt(req.query.limit) ?? 20;
    const offset = parseOptionalInt(req.query.offset) ?? 0;

    const result = await invokeEdge(req, {
        action: 'list-chats',
        query: {
            instanceId: asTrimmedString(req.query.instanceId) ?? await resolvePreferredInstanceId(req),
            limit,
            offset,
            search: asTrimmedString(req.query.search) ?? '',
        },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
    const contacts = conversations.map((entry) => {
        const mapped = mapConversation(entry);
        return {
            id: mapped.id,
            name: mapped.name,
            avatar: mapped.avatar,
            phoneNumber: mapped.phoneNumber,
            jid: asTrimmedString(asObject(entry).wa_chat_id) ?? '',
        };
    });

    res.status(200).json({ contacts, total: offset + contacts.length, limit, offset, hasMore: payload.hasMore === true });
});

router.get('/conversations/providers/uaz/qr', async (req: Request, res: Response) => {
    const instanceId = asTrimmedString(req.query.instanceId) ?? await resolvePreferredInstanceId(req);

    if (!instanceId) {
        res.status(404).json({ error: 'Instância do WhatsApp não configurada.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'get-status',
        query: { instanceId },
    });

    if (result.status >= 400) {
        res.status(result.status).json(result.payload);
        return;
    }

    const payload = asObject(result.payload);
    const instance = asObject(payload.instance);

    res.status(200).json({
        qrCode: asTrimmedString(instance.qrcode) ?? null,
        status: asTrimmedString(instance.status) ?? 'pending',
        expiresAt: null,
        messages: [],
    });
});

router.post('/conversations/providers/uaz/provision', async (req: Request, res: Response) => {
    const requestedName = asTrimmedString(req.body?.instanceName) ?? asTrimmedString(req.body?.sessionName) ?? 'QuantumJud';

    const createResult = await invokeEdge(req, {
        action: 'create-instance',
        method: 'POST',
        body: { name: requestedName },
    });

    if (createResult.status >= 400) {
        res.status(createResult.status).json(createResult.payload);
        return;
    }

    const createPayload = asObject(createResult.payload);
    const instance = asObject(createPayload.instance);
    const uazapiPayload = asObject(createPayload.uazapi);
    const uazapiInstance = asObject(uazapiPayload.instance);

    const instanceId =
        asTrimmedString(instance.id) ??
        asTrimmedString(instance.uazapi_instance_id) ??
        asTrimmedString(uazapiInstance.id) ??
        asTrimmedString(uazapiPayload.instanceId);

    if (!instanceId) {
        const payloadFieldStatus = {
            'instance.id': instance.id ?? null,
            'instance.uazapi_instance_id': instance.uazapi_instance_id ?? null,
            'uazapi.instance.id': uazapiInstance.id ?? null,
            'uazapi.instanceId': uazapiPayload.instanceId ?? null,
        };

        res.status(500).json({
            error: 'Não foi possível mapear o instanceId para conexão após criação da instância. Verifique o formato do payload retornado pela Edge Function.',
            payloadFieldStatus,
        });
        return;
    }

    const connectResult = await invokeEdge(req, {
        action: 'connect-instance',
        method: 'POST',
        body: { instanceId },
    });

    res.status(connectResult.status).json(connectResult.payload);
});

router.post('/conversations/providers/uaz/disconnect', async (req: Request, res: Response) => {
    const instanceId = asTrimmedString(req.body?.instanceId) ?? await resolvePreferredInstanceId(req);

    if (!instanceId) {
        res.status(404).json({ error: 'Nenhuma instância configurada para desconectar.' });
        return;
    }

    const result = await invokeEdge(req, {
        action: 'disconnect-instance',
        method: 'POST',
        body: { instanceId },
    });

    res.status(result.status).json(result.payload);
});

export default router;
