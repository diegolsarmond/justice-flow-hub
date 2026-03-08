import { getApiUrl } from "@/lib/api";

const JSON_HEADERS = { Accept: "application/json" } as const;

export interface PendingAgendaCountResponse {
    count: number;
}

export async function fetchPendingAgendaCount(): Promise<number> {
    const url = getApiUrl("agendas/pending-count");

    const response = await fetch(url, {
        method: "GET",
        headers: JSON_HEADERS,
    });

    if (!response.ok) {
        throw new Error(`Falha ao carregar contador de agenda (${response.status})`);
    }

    const payload = (await response.json()) as PendingAgendaCountResponse;
    return typeof payload.count === 'number' ? payload.count : 0;
}
