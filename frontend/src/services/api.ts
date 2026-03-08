import { getApiUrl } from '../lib/api';
import { WebhookConfig } from '../types';

export const api = {
    getWebhooks: async (instanceToken: string): Promise<WebhookConfig[]> => {
        try {
            const response = await fetch(getApiUrl(`/webhooks/${instanceToken}`));
            if (!response.ok) {
                throw new Error('Failed to fetch webhooks');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching webhooks:', error);
            return [];
        }
    },

    manageWebhook: async (
        action: 'add' | 'update' | 'delete',
        data: Partial<WebhookConfig>,
        instanceToken: string
    ): Promise<boolean> => {
        try {
            const response = await fetch(getApiUrl(`/webhooks/${instanceToken}`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    ...data
                }),
            });
            return response.ok;
        } catch (error) {
            console.error('Error managing webhook:', error);
            return false;
        }
    }
};
