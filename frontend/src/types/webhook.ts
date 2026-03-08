export interface WebhookConfig {
    id: string;
    url: string;
    events: string[];
    excludeMessages?: string[];
    enabled: boolean;
    addUrlEvents?: boolean;
    addUrlTypesMessages?: boolean;
}
