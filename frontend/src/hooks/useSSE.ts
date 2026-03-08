
import { useEffect, useRef } from 'react';
import { appConfig } from '@/config/app-config';

interface SSEEvent {
    type: string;
    payload: any;
}

const API_BASE_URL = appConfig.apiBaseUrl || '';

export const useSSE = (
    onMessage?: (msg: any) => void,
    onUpdate?: (update: any) => void
) => {
    const onMessageRef = useRef(onMessage);
    const onUpdateRef = useRef(onUpdate);

    useEffect(() => {
        onMessageRef.current = onMessage;
        onUpdateRef.current = onUpdate;
    }, [onMessage, onUpdate]);

    useEffect(() => {
        // Solicitar permissão de notificação
        if (Notification.permission === 'default') {
            try {
                Notification.requestPermission();
            } catch (e) {
                console.error("Error requesting notification permission", e);
            }
        }

        const token = localStorage.getItem('token');
        const instanceToken = localStorage.getItem('instanceToken');
        if (!token) return;

        // Conectar ao endpoint SSE
        // Usamos o endpoint /sse que faz proxy para o provider externo
        // O token de autenticação é passado via query param
        const events = 'chats,messages,messages_update';
        const url = `${API_BASE_URL}/sse?token=${instanceToken || token}&events=${events}`;
        const eventSource = new EventSource(url);


        const handleEvent = (event: MessageEvent) => {
            try {
                // Parse do data, que deve ser um JSON
                const parsedData = JSON.parse(event.data || '{}');

                // O formato pode ser { type: 'message', data: {...} } ou diretamente o payload
                // A documentação diz: { "type": "message", "data": { ... } }
                const eventType = parsedData.type || event.type;
                const payload = parsedData.data || parsedData;

                // Log para debug (opcional, mas útil para entender o fluxo)
                // console.log('SSE Event:', eventType, payload);

                // Detectar se é uma mensagem
                const isMessage =
                    eventType === 'message' ||
                    eventType === 'messages' ||
                    eventType === 'message:new' ||
                    eventType?.includes('message');

                if (isMessage) {
                    if (onMessageRef.current) onMessageRef.current(payload);

                    // Notificação Desktop
                    if (document.hidden && Notification.permission === 'granted') {
                        const msgData = payload.data || payload; // Caso o payload ainda tenha um wrapper
                        const text = msgData.body || msgData.text || msgData.conversation || 'Nova mensagem';
                        try {
                            new Notification('Nova Mensagem', {
                                body: String(text),
                                icon: '/vite.svg'
                            });
                        } catch (e) {
                            console.error("Error showing notification", e);
                        }
                    }
                }
                // Detectar se é update/status
                else if (eventType && (eventType.includes('update') || eventType.includes('status'))) {
                    if (onUpdateRef.current) onUpdateRef.current(payload);
                }
            } catch (err) {
                console.error('Error parsing SSE event', err);
            }
        };

        eventSource.onopen = () => {
            console.log('SSE Connected');
        };

        eventSource.onmessage = handleEvent;
        // Mantendo listeners específicos por precaução
        eventSource.addEventListener('message', handleEvent);
        eventSource.addEventListener('messages', handleEvent);
        eventSource.addEventListener('message:new', handleEvent);
        eventSource.addEventListener('message:status', handleEvent);
        eventSource.addEventListener('session:status', handleEvent);

        eventSource.onerror = (err) => {
            console.error('SSE Error', err);
            eventSource.close();
            // Reconexão automática é nativa do EventSource, mas se fechar explicitamente, precisa reabrir.
            // Deixar o navegador gerenciar reconexão se for apenas disconnect de rede.
        };

        return () => {
            eventSource.close();
        };
    }, []); // Empty dependency array to ensure it only runs once (or when component mounts/unmounts)
};
