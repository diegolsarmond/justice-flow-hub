import React, { useState, useEffect } from 'react';
import { WebhookConfig } from './types';
import { api } from './services/api';
import { Plus, Trash2, Edit2, Check, X, Globe, Activity, Filter, Settings, RefreshCw } from 'lucide-react';

interface WebhookManagerProps {
    instanceToken: string;
    initialWebhooks?: WebhookConfig[];
    onUpdate?: () => void;
}

const AVAILABLE_EVENTS = [
    'connection', 'history', 'messages', 'messages_update', 'call',
    'contacts', 'presence', 'groups', 'labels', 'chats',
    'chat_labels', 'blocks', 'leads', 'sender'
];

const EXCLUDE_FILTERS = [
    { id: 'wasSentByApi', label: 'Enviado pela API' },
    { id: 'wasNotSentByApi', label: 'Não enviado pela API' },
    { id: 'fromMeYes', label: 'Enviado por mim' },
    { id: 'fromMeNo', label: 'Recebido de outros' },
    { id: 'isGroupYes', label: 'Mensagens de Grupo' },
    { id: 'isGroupNo', label: 'Mensagens Privadas' }
];

const WebhookManager: React.FC<WebhookManagerProps> = ({ instanceToken, initialWebhooks = [], onUpdate }) => {
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>(initialWebhooks);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentWebhook, setCurrentWebhook] = useState<Partial<WebhookConfig>>({
        url: '',
        events: ['messages'],
        excludeMessages: ['wasSentByApi'],
        enabled: true,
        addUrlEvents: false,
        addUrlTypesMessages: false
    });

    useEffect(() => {
        if (initialWebhooks.length > 0) {
            setWebhooks(initialWebhooks);
        } else {
            fetchWebhooks();
        }
    }, [instanceToken]);

    const fetchWebhooks = async () => {
        setLoading(true);
        try {
            const data = await api.getWebhooks(instanceToken);
            setWebhooks(data);
        } catch (error) {
            console.error("Error fetching webhooks", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentWebhook.url) return;

        setLoading(true);
        try {
            const action = currentWebhook.id ? 'update' : 'add';
            const success = await api.manageWebhook(action, currentWebhook, instanceToken);

            if (success) {
                await fetchWebhooks();
                setIsEditing(false);
                resetForm();
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error("Error saving webhook", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja remover este webhook?')) return;

        setLoading(true);
        try {
            const success = await api.manageWebhook('delete', { id }, instanceToken);
            if (success) {
                await fetchWebhooks();
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error("Error deleting webhook", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (webhook: WebhookConfig) => {
        setCurrentWebhook({ ...webhook });
        setIsEditing(true);
    };

    const handleToggleEnabled = async (webhook: WebhookConfig) => {
        const newState = !webhook.enabled;
        // Optimistic update
        setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, enabled: newState } : w));

        try {
            await api.manageWebhook('update', { id: webhook.id, enabled: newState }, instanceToken);
        } catch (error) {
            console.error("Error toggling webhook", error);
            fetchWebhooks(); // Revert on error
        }
    };

    const resetForm = () => {
        setCurrentWebhook({
            url: '',
            events: ['messages'],
            excludeMessages: ['wasSentByApi'],
            enabled: true,
            addUrlEvents: false,
            addUrlTypesMessages: false
        });
    };

    const toggleEvent = (event: string) => {
        const currentEvents = currentWebhook.events || [];
        if (currentEvents.includes(event)) {
            setCurrentWebhook({ ...currentWebhook, events: currentEvents.filter(e => e !== event) });
        } else {
            setCurrentWebhook({ ...currentWebhook, events: [...currentEvents, event] });
        }
    };

    const toggleExclude = (filter: string) => {
        const currentExclude = currentWebhook.excludeMessages || [];
        if (currentExclude.includes(filter)) {
            setCurrentWebhook({ ...currentWebhook, excludeMessages: currentExclude.filter(e => e !== filter) });
        } else {
            setCurrentWebhook({ ...currentWebhook, excludeMessages: [...currentExclude, filter] });
        }
    };

    if (isEditing) {
        return (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                    {currentWebhook.id ? <Edit2 size={16} /> : <Plus size={16} />}
                    {currentWebhook.id ? 'Editar Webhook' : 'Novo Webhook'}
                </h4>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL do Webhook</label>
                    <input
                        type="text"
                        value={currentWebhook.url}
                        onChange={(e) => setCurrentWebhook({ ...currentWebhook, url: e.target.value })}
                        placeholder="https://seu-sistema.com/webhook"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00a884] outline-none"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <Activity size={12} /> Eventos para Escutar
                        </label>
                        <div className="bg-white p-3 rounded-lg border border-gray-200 max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                            {AVAILABLE_EVENTS.map(event => (
                                <label key={event} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                    <input
                                        type="checkbox"
                                        checked={(currentWebhook.events || []).includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="rounded text-[#00a884] focus:ring-[#00a884]"
                                    />
                                    {event}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <Filter size={12} /> Filtros de Exclusão
                        </label>
                        <div className="bg-white p-3 rounded-lg border border-gray-200 max-h-40 overflow-y-auto space-y-2">
                            {EXCLUDE_FILTERS.map(filter => (
                                <label key={filter.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                    <input
                                        type="checkbox"
                                        checked={(currentWebhook.excludeMessages || []).includes(filter.id)}
                                        onChange={() => toggleExclude(filter.id)}
                                        className="rounded text-[#00a884] focus:ring-[#00a884]"
                                    />
                                    {filter.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={currentWebhook.enabled}
                            onChange={(e) => setCurrentWebhook({ ...currentWebhook, enabled: e.target.checked })}
                            className="rounded text-[#00a884] focus:ring-[#00a884]"
                        />
                        Ativo
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" title="Adiciona o evento na URL (ex: /webhook/message)">
                        <input
                            type="checkbox"
                            checked={currentWebhook.addUrlEvents}
                            onChange={(e) => setCurrentWebhook({ ...currentWebhook, addUrlEvents: e.target.checked })}
                            className="rounded text-[#00a884] focus:ring-[#00a884]"
                        />
                        Add Evento na URL
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" title="Adiciona o tipo de mensagem na URL (ex: /webhook/conversation)">
                        <input
                            type="checkbox"
                            checked={currentWebhook.addUrlTypesMessages}
                            onChange={(e) => setCurrentWebhook({ ...currentWebhook, addUrlTypesMessages: e.target.checked })}
                            className="rounded text-[#00a884] focus:ring-[#00a884]"
                        />
                        Add Tipo Msg na URL
                    </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                    <button
                        onClick={() => { setIsEditing(false); resetForm(); }}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !currentWebhook.url}
                        className="px-3 py-1.5 bg-[#00a884] text-white rounded text-sm hover:bg-[#008f6f] transition flex items-center gap-1 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                        Salvar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Webhooks Configurados</label>
                <button
                    onClick={() => { resetForm(); setIsEditing(true); }}
                    className="text-[#00a884] hover:bg-[#00a884]/10 p-1.5 rounded text-xs font-bold flex items-center gap-1 transition"
                >
                    <Plus size={14} /> Adicionar
                </button>
            </div>

            {loading && !webhooks.length && (
                <div className="text-center py-4 text-gray-400 text-xs">Carregando webhooks...</div>
            )}

            {!loading && webhooks.length === 0 && (
                <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                    Nenhum webhook configurado.
                </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {webhooks.map(webhook => (
                    <div key={webhook.id} className={`p-3 rounded-lg border transition group ${webhook.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Globe size={14} className="text-gray-400" />
                                    <span className="font-medium text-sm text-gray-800 truncate" title={webhook.url}>{webhook.url}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {(webhook.events || []).slice(0, 3).map(e => (
                                        <span key={e} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                            {e}
                                        </span>
                                    ))}
                                    {(webhook.events || []).length > 3 && (
                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                            +{webhook.events.length - 3}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    onClick={() => handleToggleEnabled(webhook)}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${webhook.enabled ? 'bg-[#00a884]' : 'bg-gray-300'}`}
                                    title={webhook.enabled ? 'Desativar' : 'Ativar'}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${webhook.enabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: webhook.enabled ? 'calc(100% - 14px)' : '2px' }} />
                                </button>
                                <button
                                    onClick={() => handleEdit(webhook)}
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                                    title="Editar"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(webhook.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                    title="Excluir"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WebhookManager;
