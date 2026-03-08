import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProcessCard } from "@/components/ui/process-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePlan } from "@/features/plans/PlanProvider";
import { useToast } from "@/hooks/use-toast";
import { fetchMeuPerfil } from "@/services/meuPerfil";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from "@/components/ui/pagination";
import {
    Archive,
    Check,
    Calendar,
    Clock,
    FileText,
    Gavel as GavelIcon,
    Landmark,
    MapPin,
    Search,
    Users as UsersIcon,
    ChevronsUpDown,
    RefreshCw,
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Loader2,
    Filter,
    SlidersHorizontal,
    AlertCircle,
    Eye,
    Trash2,
    AlertTriangle,
} from "lucide-react";

const NO_EXISTING_CLIENT_SELECT_VALUE = "__no_existing_client__";
const NO_PROPOSTA_SELECT_VALUE = "__no_proposta__";
const VALID_UF_CODES = new Set([
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]);

const BRAZILIAN_UFS = new Set([
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]);

const normalizeUfCandidate = (value: string | undefined): string | null => {
    if (!value) {
        return null;
    }

    const candidate = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(candidate)) {
        return null;
    }

    if (!BRAZILIAN_UFS.has(candidate)) {
        return null;
    }

    return candidate;
};

const normalizeSearchableText = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

interface ProcessoCliente {
    id: number;
    nome: string;
    documento: string;
    papel: string;
}

interface ProcessoAdvogado {
    id: number;
    nome: string;
    funcao?: string;
    oab?: string | null;
}

interface ProcessoProposta {
    id: number;
    label: string;
    solicitante?: string | null;
}

export interface Processo {
    id: number;
    numero: string;
    dataDistribuicao: string;
    status: string;
    tipo: string;
    cliente: ProcessoCliente;
    advogados: ProcessoAdvogado[];
    advogadosResumo: string | null;
    advogadoResponsavel: string | null;
    classeJudicial: string;
    assunto: string;
    jurisdicao: string;
    orgaoJulgador: string;
    proposta: ProcessoProposta | null;
    ultimaSincronizacao: string | null;
    ultimaMovimentacao: string;
    ultimaMovimentacaoData: string | null;
    ultimaMovimentacaoTipo: string | null;
    ultimaMovimentacaoDescricao: string | null;
    consultasApiCount: number;
    movimentacoesCount: number;
    grau: string | null;
    idempresa: number | null;
    nao_lido: boolean;
    idusuario_leitura: number | null;
    lido_em: string | null;
}

interface ProcessoSummary {
    andamento: number;
    arquivados: number;
    clientes: number;
    totalSincronizacoes: number;
    totalPrimeiraInstancia?: number;
    totalSegundaInstancia?: number;
    statusOptions: string[];
    tipoOptions: string[];
}

interface ProcessoLoadResult {
    items: Processo[];
    total: number;
    page: number;
    pageSize: number;
    summary: ProcessoSummary;
    agrupadosPorNumero: Record<string, Processo[]>;
}

interface Municipio {
    id: number;
    nome: string;
}

interface Uf {
    id: number;
    sigla: string;
    nome: string;
}

interface ClienteResumo {
    id: number;
    nome: string;
    documento: string;
    tipo: string;
}

interface ApiCliente {
    id: number;
    nome?: string;
    documento?: string;
    tipo?: string;
}

interface ApiProcessoCliente {
    id: number;
    nome: string | null;
    documento: string | null;
    tipo: string | null;
}

interface ApiProcessoOportunidade {
    id?: number | string | null;
    sequencial_empresa?: number | string | null;
    data_criacao?: string | null;
    numero_processo_cnj?: string | null;
    numero_protocolo?: string | null;
    solicitante_id?: number | string | null;
    solicitante_nome?: string | null;
}

interface ApiProcesso {
    id: number;
    cliente_id: number;
    numero: string;
    uf: string | null;
    municipio: string | null;
    orgao_julgador: string | null;
    tipo: string | null;
    status: string | null;
    classe_judicial: string | null;
    assunto: string | null;
    jurisdicao: string | null;
    advogado_responsavel: string | null;
    data_distribuicao: string | null;
    criado_em: string | null;
    atualizado_em: string | null;
    cliente?: ApiProcessoCliente | null;
    oportunidade_id?: number | string | null;
    oportunidade?: ApiProcessoOportunidade | null;
    advogados?: ApiProcessoAdvogado[] | null;
    ultima_sincronizacao?: string | null;
    ultima_movimentacao?: string | null;
    ultima_movimentacao_data?: string | null;
    ultima_movimentacao_tipo?: string | null;
    ultima_movimentacao_descricao?: string | null;
    advogados_resumo?: string | null;
    consultas_api_count?: number | string | null;
    movimentacoes_count?: number | string | null;
    grau?: string | number | null;
    idempresa?: number | string | null;
    nao_lido?: boolean | null;
    idusuario_leitura?: number | string | null;
    lido_em?: string | null;
}

interface ApiProcessoAdvogado {
    id?: number | string | null;
    nome?: string | null;
    name?: string | null;
    funcao?: string | null;
    cargo?: string | null;
    perfil?: string | null;
    perfil_nome?: string | null;
    oab?: string | null;
}

interface MarkProcessoAsReadResponse {
    id: number;
    nao_lido: boolean;
    idusuario_leitura: number | null;
    lido_em: string | null;
    atualizado_em?: string | null;
}

interface AdvogadoOption {
    id: string;
    nome: string;
    descricao?: string;
}

interface SimpleOption {
    id: string;
    nome: string;
}

interface ApiOportunidade {
    id?: number | string | null;
    sequencial_empresa?: number | string | null;
    data_criacao?: string | null;
    solicitante_nome?: string | null;
    solicitante?: { nome?: string | null } | null;
}

interface PropostaOption {
    id: string;
    label: string;
    solicitante?: string | null;
    sequencial?: number | null;
    dataCriacao?: string | null;
    solicitanteId: string | null;
}

interface ProcessFormState {
    numero: string;
    uf: string;
    municipio: string;
    clienteId: string;
    advogados: string[];
    propostaId: string;
    dataDistribuicao: string;
    instancia: string;
    instanciaOutro: string;
    areaAtuacaoId: string;
    tipoProcessoId: string;
    sistemaCnjId: string;
    monitorarProcesso: boolean;
}

interface OabMonitor {
    id: number;
    uf: string;
    numero: string;
    createdAt: string | null;
    updatedAt: string | null;
    syncFrom: string | null;
    usuarioId: number | null;
    usuarioNome: string | null;
    usuarioOab: string | null;
    diasSemana: number[] | null;
}

const DIA_SEMANA_LABELS: Record<number, string> = {
    1: "Domingo",
    2: "Segunda-feira",
    3: "Terça-feira",
    4: "Quarta-feira",
    5: "Quinta-feira",
    6: "Sexta-feira",
    7: "Sábado",
};

const BUSINESS_DAY_VALUES = [2, 3, 4, 5, 6] as const;

const DEFAULT_MONITOR_DAYS = [...BUSINESS_DAY_VALUES];

const BUSINESS_DAY_SET = new Set<number>(BUSINESS_DAY_VALUES);

interface OabUsuarioOption {
    id: string;
    nome: string;
    oab: string | null;
    oabNumero: string | null;
    oabUf: string | null;
}

const UNASSIGNED_PAGE_SIZE = 5;

interface ApiProcessoParticipant {
    id?: number | string | null;
    name?: string | null;
    document?: string | null;
    role?: string | null;
    side?: string | null;
    type?: string | null;
    person_type?: string | null;
    party_role?: string | null;
}

interface ProcessoParticipantOption {
    id: string;
    name: string;
    document: string;
    side: string | null;
    role: string | null;
    type: string | null;
}

interface UnassignedProcessDetail {
    process: Processo;
    form: ProcessFormState;
    grau: string;
    participants: ProcessoParticipantOption[];
    selectedExistingClientId: string;
    selectedParticipantIds: string[];
    primaryParticipantId: string | null;
    relationshipByParticipantId: Record<string, string>;
    selectedPropostaId: string;
    saving: boolean;
    error: string | null;
}

const formatProcessNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 20);
    const match = digits.match(/^(\d{0,7})(\d{0,2})(\d{0,4})(\d{0,1})(\d{0,2})(\d{0,4})$/);
    if (!match) return digits;
    const [, part1 = "", part2 = "", part3 = "", part4 = "", part5 = "", part6 = ""] = match;

    let formatted = part1;
    if (part2) formatted += `-${part2}`;
    if (part3) formatted += `.${part3}`;
    if (part4) formatted += `.${part4}`;
    if (part5) formatted += `.${part5}`;
    if (part6) formatted += `.${part6}`;
    return formatted;
};

const formatDateToPtBR = (value: string | null | undefined): string => {
    if (!value) {
        return "Não informado";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Não informado";
    }

    return date.toLocaleDateString("pt-BR");
};

const formatDateTimeToPtBR = (value: string | null | undefined): string => {
    if (!value) {
        return "Sem registros";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Data inválida";
    }

    return date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

const formatOabDigits = (value: string): string => value.replace(/\D/g, "").slice(0, 12);
const normalizeUf = (value: string): string => value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();

const parseApiSyncFrom = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }

    const [yearText, monthText, dayText] = trimmed.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    const parsed = new Date(year, month - 1, day);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return null;
    }

    return trimmed;
};

const parseSyncFromDate = (value: string | null | undefined): Date | null => {
    if (!value) {
        return null;
    }

    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    const parsed = new Date(year, month - 1, day);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return null;
    }

    return parsed;
};

const formatSyncFromValue = (value: string | null | undefined): string => {
    if (!value) {
        return "Tudo";
    }

    const parsed = parseSyncFromDate(value);

    if (!parsed) {
        return "Tudo";
    }

    return parsed.toLocaleDateString("pt-BR");
};

const formatSyncFromDateLabel = (value: Date | null): string => {
    if (!value) {
        return "Selecione uma data";
    }

    return value.toLocaleDateString("pt-BR");
};

const toIsoDateString = (value: Date): string => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const UF_BY_RAMO_TR: Record<string, Record<string, string>> = {
    "8": {
        "01": "AC",
        "02": "AL",
        "03": "AM",
        "04": "AP",
        "05": "BA",
        "06": "CE",
        "07": "DF",
        "08": "ES",
        "09": "GO",
        "10": "MA",
        "11": "MT",
        "12": "MS",
        "13": "MG",
        "14": "PA",
        "15": "PB",
        "16": "PR",
        "17": "PE",
        "18": "PI",
        "19": "RJ",
        "20": "RN",
        "21": "RS",
        "22": "RO",
        "23": "RR",
        "24": "SC",
        "25": "SE",
        "26": "SP",
        "27": "TO",
    },
};

const inferUfFromProcessNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) {
        return "";
    }

    const ramoIndex = digits.length - 7;
    const ramo = digits.charAt(ramoIndex);
    const tribunal = digits.slice(ramoIndex + 1, ramoIndex + 3);
    if (!ramo || tribunal.length !== 2) {
        return "";
    }


    const ramoMap = UF_BY_RAMO_TR[ramo];
    return ramoMap?.[tribunal] ?? "";
};

const parseApiDiasSemana = (value: unknown): number[] | null => {
    if (value === null || value === undefined) {
        return null;
    }

    const collect = (entries: unknown[]): number[] => {
        const set = new Set<number>();

        for (const entry of entries) {
            let parsed: number | null = null;

            if (typeof entry === "number" && Number.isFinite(entry)) {
                parsed = Math.trunc(entry);
            } else if (typeof entry === "string") {
                const trimmed = entry.trim();
                if (trimmed) {
                    const candidate = Number.parseInt(trimmed, 10);
                    if (Number.isFinite(candidate)) {
                        parsed = Math.trunc(candidate);
                    }
                }
            }

            if (parsed != null && parsed >= 1 && parsed <= 7) {
                set.add(parsed);
            }
        }

        if (set.size === 0) {
            return [];
        }

        return Array.from(set).sort((a, b) => a - b);
    };

    if (Array.isArray(value)) {
        return collect(value);
    }

    if (typeof value === "string") {
        const normalized = value.replace(/[{}]/g, "");
        if (!normalized.trim()) {
            return [];
        }
        return collect(normalized.split(","));
    }

    return null;
};

const formatDiasSemanaDescription = (dias: number[] | null | undefined): string => {
    if (!dias) {
        return "Sincroniza todos os dias da semana.";
    }

    if (dias.length === 0) {
        return "Sincronização sem dias selecionados.";
    }

    const normalized = Array.from(new Set(dias)).sort((a, b) => a - b);

    if (normalized.length === 7) {
        return "Sincroniza todos os dias da semana.";
    }

    if (normalized.length === BUSINESS_DAY_VALUES.length && BUSINESS_DAY_VALUES.every((value, index) => value === normalized[index])) {
        return "Sincroniza de segunda a sexta-feira.";
    }

    const labels = normalized
        .map((value) => DIA_SEMANA_LABELS[value])
        .filter((label): label is string => Boolean(label));

    if (labels.length === 0) {
        return "Sincroniza em dias configurados.";
    }

    if (labels.length === 1) {
        return `Sincroniza em ${labels[0]}.`;
    }

    const last = labels[labels.length - 1];
    const initial = labels.slice(0, -1).join(", ");
    return `Sincroniza em ${initial} e ${last}.`;
};

const mapApiOabMonitor = (payload: Record<string, unknown>): OabMonitor | null => {
    const idValue = parseOptionalInteger(payload.id);
    const ufRaw = pickFirstNonEmptyString(
        typeof payload.uf === "string" ? payload.uf : undefined,
        typeof (payload as { UF?: string }).UF === "string" ? (payload as { UF: string }).UF : undefined,
    );
    const numeroRaw = pickFirstNonEmptyString(
        typeof payload.numero === "string" ? payload.numero : undefined,
        typeof (payload as { number?: string }).number === "string"
            ? (payload as { number: string }).number
            : undefined,
    );

    if (!idValue || !ufRaw || !numeroRaw) {
        return null;
    }

    const numero = formatOabDigits(numeroRaw);
    if (!numero) {
        return null;
    }

    const uf = normalizeUf(ufRaw);
    if (uf.length !== 2) {
        return null;
    }

    const createdAt = pickFirstNonEmptyString(
        typeof (payload as { createdAt?: string }).createdAt === "string"
            ? (payload as { createdAt: string }).createdAt
            : undefined,
        typeof (payload as { created_at?: string }).created_at === "string"
            ? (payload as { created_at: string }).created_at
            : undefined,
    );

    const updatedAt = pickFirstNonEmptyString(
        typeof (payload as { updatedAt?: string }).updatedAt === "string"
            ? (payload as { updatedAt: string }).updatedAt
            : undefined,
        typeof (payload as { updated_at?: string }).updated_at === "string"
            ? (payload as { updated_at: string }).updated_at
            : undefined,
    );

    const syncFrom = parseApiSyncFrom(
        (payload as { syncFrom?: unknown }).syncFrom ??
        (payload as { sync_from?: unknown }).sync_from ??
        null,
    );

    const usuarioId = parseOptionalInteger(
        (payload as { usuarioId?: unknown }).usuarioId ??
        (payload as { usuario_id?: unknown }).usuario_id,
    );

    const usuarioNome = pickFirstNonEmptyString(
        typeof (payload as { usuarioNome?: string }).usuarioNome === "string"
            ? (payload as { usuarioNome: string }).usuarioNome
            : undefined,
        typeof (payload as { usuario_nome?: string }).usuario_nome === "string"
            ? (payload as { usuario_nome: string }).usuario_nome
            : undefined,
        typeof (payload as { nome_usuario?: string }).nome_usuario === "string"
            ? (payload as { nome_usuario: string }).nome_usuario
            : undefined,
    );

    const usuarioOab = pickFirstNonEmptyString(
        typeof (payload as { usuarioOab?: string }).usuarioOab === "string"
            ? (payload as { usuarioOab: string }).usuarioOab
            : undefined,
        typeof (payload as { usuario_oab?: string }).usuario_oab === "string"
            ? (payload as { usuario_oab: string }).usuario_oab
            : undefined,
    );

    const diasSemanaRaw =
        (payload as { diasSemana?: unknown }).diasSemana ??
        (payload as { dias_semana?: unknown }).dias_semana ??
        null;

    return {
        id: idValue,
        uf,
        numero,
        createdAt: createdAt ?? null,
        updatedAt: updatedAt ?? null,
        syncFrom,
        usuarioId: usuarioId,
        usuarioNome: usuarioNome ?? null,
        usuarioOab: usuarioOab ?? null,
        diasSemana: parseApiDiasSemana(diasSemanaRaw),
    };
};

const formatOabDisplay = (numero: string, uf: string): string => {
    const digits = formatOabDigits(numero);
    const padded = digits.padStart(6, "0");
    const ufDisplay = normalizeUf(uf);
    return `${padded}/${ufDisplay}`;
};

const mapApiParticipantOption = (
    participant: ApiProcessoParticipant,
    index: number,
): ProcessoParticipantOption | null => {
    const name =
        pickFirstNonEmptyString(
            typeof participant.name === "string" ? participant.name : undefined,
            typeof participant.role === "string" ? participant.role : undefined,
            typeof participant.party_role === "string" ? participant.party_role : undefined,
        ) ?? `Envolvido ${index + 1}`;

    const document = typeof participant.document === "string" ? participant.document.trim() : "";

    const type = pickFirstNonEmptyString(
        typeof participant.type === "string" ? participant.type : undefined,
        typeof participant.person_type === "string" ? participant.person_type : undefined,
    );

    const role = pickFirstNonEmptyString(
        typeof participant.role === "string" ? participant.role : undefined,
        typeof participant.party_role === "string" ? participant.party_role : undefined,
    );

    const side = typeof participant.side === "string" ? participant.side : null;

    const idCandidates: string[] = [];

    if (typeof participant.id === "string" && participant.id.trim().length > 0) {
        idCandidates.push(participant.id.trim());
    } else if (typeof participant.id === "number" && Number.isFinite(participant.id)) {
        idCandidates.push(String(Math.trunc(participant.id)));
    }

    if (document) {
        const digitsForId = document.replace(/\D/g, "");
        if (digitsForId) {
            idCandidates.push(`doc-${digitsForId}`);
        }
    }

    idCandidates.push(`participant-${index}`);

    const uniqueId = idCandidates.find((candidate) => candidate.length > 0) ?? `participant-${index}`;

    return {
        id: uniqueId,
        name,
        document,
        side,
        role: role ?? null,
        type: type ?? null,
    };
};

const extractParticipantOptions = (payload: Record<string, unknown>): ProcessoParticipantOption[] => {
    const participantsPayload = Array.isArray((payload as { participants?: unknown }).participants)
        ? ((payload as { participants: ApiProcessoParticipant[] }).participants)
        : [];
    const partiesPayload = Array.isArray((payload as { parties?: unknown }).parties)
        ? ((payload as { parties: ApiProcessoParticipant[] }).parties)
        : [];

    const combined = [...participantsPayload, ...partiesPayload];

    const options: ProcessoParticipantOption[] = [];
    const usedIds = new Set<string>();
    const usedDocuments = new Set<string>();

    combined.forEach((participant, index) => {
        if (!participant || typeof participant !== "object") {
            return;
        }

        const option = mapApiParticipantOption(participant as ApiProcessoParticipant, index);
        if (!option) {
            return;
        }

        const digits = option.document.replace(/\D/g, "");
        if (digits) {
            if (usedDocuments.has(digits)) {
                return;
            }
            usedDocuments.add(digits);
        }

        let candidateId = option.id;
        while (usedIds.has(candidateId)) {
            candidateId = `${candidateId}-${index}`;
        }
        usedIds.add(candidateId);

        options.push({ ...option, id: candidateId });
    });

    return options;
};

const getParticipantDefaultRelationship = (participant: ProcessoParticipantOption): string => {
    if (participant.role) {
        return participant.role;
    }

    if (participant.side) {
        return participant.side.charAt(0).toUpperCase() + participant.side.slice(1);
    }

    return "";
};

const getParticipantDocumentDigits = (participant: ProcessoParticipantOption): string =>
    participant.document.replace(/\D/g, "");

const pickFirstNonEmptyString = (
    ...values: Array<string | null | undefined>
): string | undefined => {
    for (const value of values) {
        if (!value || typeof value !== "string") {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return undefined;
};

const sanitizeOabUfValue = (value: string | null | undefined): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = normalizeUf(value);
    return normalized.length === 2 ? normalized : null;
};

const sanitizeOabNumberValue = (value: string | null | undefined): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const digits = value.replace(/\D/g, "").slice(0, 12);
    return digits ? digits : null;
};

const extractCombinedOabData = (
    value: string | null | undefined,
): { numero: string | null; uf: string | null } => {
    if (typeof value !== "string") {
        return { numero: null, uf: null };
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return { numero: null, uf: null };
    }

    const normalized = trimmed.replace(/^OAB\s*/i, "");

    if (normalized.includes("/")) {
        const [left, right] = normalized.split("/");
        const numero = sanitizeOabNumberValue(left);
        const uf = sanitizeOabUfValue(right);
        return { numero, uf };
    }

    const match = normalized.match(/([A-Za-z]{2})[^A-Za-z0-9]*([0-9]+)/);

    if (match) {
        const [, ufRaw, numeroRaw] = match;
        return {
            numero: sanitizeOabNumberValue(numeroRaw),
            uf: sanitizeOabUfValue(ufRaw),
        };
    }

    return { numero: sanitizeOabNumberValue(normalized), uf: null };
};

const toCandidateString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }

    return undefined;
};

const getLoggedLawyerOab = (user: unknown): { numero: string | null; uf: string | null } => {
    if (!user || typeof user !== "object") {
        return { numero: null, uf: null };
    }

    const record = user as Record<string, unknown>;

    const explicitNumero = sanitizeOabNumberValue(
        pickFirstNonEmptyString(
            toCandidateString(record["oabNumber"]),
            toCandidateString(record["oab_number"]),
            toCandidateString(record["oabNumero"]),
            toCandidateString(record["oab_numero"]),
            toCandidateString(record["numero_oab"]),
            toCandidateString(record["numeroOab"]),
        ),
    );

    const explicitUf = sanitizeOabUfValue(
        pickFirstNonEmptyString(
            toCandidateString(record["oabUf"]),
            toCandidateString(record["oab_uf"]),
            toCandidateString(record["uf_oab"]),
            toCandidateString(record["ufOab"]),
        ),
    );

    let numero = explicitNumero;
    let uf = explicitUf;

    const combinedSource = record["oab"];

    if (!numero || !uf) {
        if (typeof combinedSource === "string") {
            const combined = extractCombinedOabData(combinedSource);
            if (!numero && combined.numero) {
                numero = combined.numero;
            }
            if (!uf && combined.uf) {
                uf = combined.uf;
            }
        } else if (combinedSource && typeof combinedSource === "object") {
            const combinedRecord = combinedSource as Record<string, unknown>;
            if (!numero) {
                const objectNumero = sanitizeOabNumberValue(
                    pickFirstNonEmptyString(
                        toCandidateString(combinedRecord["numero"]),
                        toCandidateString(combinedRecord["number"]),
                    ),
                );
                if (objectNumero) {
                    numero = objectNumero;
                }
            }
            if (!uf) {
                const objectUf = sanitizeOabUfValue(
                    pickFirstNonEmptyString(
                        toCandidateString(combinedRecord["uf"]),
                        toCandidateString(combinedRecord["estado"]),
                    ),
                );
                if (objectUf) {
                    uf = objectUf;
                }
            }
        }
    }

    return { numero, uf };
};

const getNameFromEmail = (email: string | null | undefined): string | undefined => {
    if (!email || typeof email !== "string") {
        return undefined;
    }

    const trimmed = email.trim();
    if (!trimmed) {
        return undefined;
    }

    const [localPart] = trimmed.split("@");
    if (!localPart) {
        return undefined;
    }

    return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase())
        .trim();
};

const parseApiInteger = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return 0;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
};

const parseOptionalInteger = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};

const extractOptionItems = (
    payload: unknown,
): Record<string, unknown>[] => {
    if (Array.isArray(payload)) {
        return payload.filter(
            (item): item is Record<string, unknown> =>
                item !== null && typeof item === "object",
        );
    }

    if (payload && typeof payload === "object") {
        const directData = (payload as { data?: unknown }).data;
        if (Array.isArray(directData)) {
            return directData.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }

        const directRows = (payload as { rows?: unknown }).rows;
        if (Array.isArray(directRows)) {
            return directRows.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }

        const nestedRows = (payload as { data?: { rows?: unknown } }).data?.rows;
        if (Array.isArray(nestedRows)) {
            return nestedRows.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }
    }

    return [];
};

const normalizeClienteTipo = (value: string | null | undefined): string => {
    if (!value) {
        return "";
    }

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
};

const resolveClientePapel = (tipo: string | null | undefined): string => {
    const normalized = normalizeClienteTipo(tipo);

    if (
        normalized.includes("JURIDICA") ||
        ["2", "J", "PJ"].includes(normalized)
    ) {
        return "Pessoa Jurídica";
    }

    if (
        normalized.includes("FISICA") ||
        ["1", "F", "PF"].includes(normalized)
    ) {
        return "Pessoa Física";
    }

    return "Parte";
};

const formatPropostaLabel = (
    id: number,
    sequencial: number | null,
    dataCriacao: string | null,
    solicitante?: string | null,
): string => {
    const numero = sequencial && sequencial > 0 ? sequencial : id;
    let ano = new Date().getFullYear();

    if (dataCriacao) {
        const parsed = new Date(dataCriacao);
        if (!Number.isNaN(parsed.getTime())) {
            ano = parsed.getFullYear();
        }
    }

    const solicitanteNome =
        typeof solicitante === "string" && solicitante.trim().length > 0
            ? solicitante.trim()
            : "";

    return `Proposta #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
};

const INSTANCIA_OUTRO_VALUE = "Outro / Especificar";

const INSTANCIA_OPTIONS = [
    "1ª Vara Cível",
    "2ª Vara Cível",
    "Vara Criminal",
    "Vara de Família",
    "Vara da Fazenda Pública",
    "Juizado Especial Cível",
    "Juizado Especial Criminal",
    "Vara do Trabalho",
    "Tribunal de Justiça (TJ) — 2ª Instância",
    "Tribunal Regional Federal (TRF) — 2ª Instância",
    "Tribunal Regional do Trabalho (TRT) — 2ª Instância",
    "Tribunal Regional Eleitoral (TRE) — 2ª Instância",
    "Turma Recursal (Juizados)",
    "Tribunal Superior do Trabalho (TST)",
    "Tribunal Superior Eleitoral (TSE)",
    "Superior Tribunal de Justiça (STJ)",
    "Supremo Tribunal Federal (STF)",
    INSTANCIA_OUTRO_VALUE,

];

const createEmptyProcessForm = (): ProcessFormState => ({
    numero: "",
    uf: "",
    municipio: "",
    clienteId: "",
    advogados: [],
    propostaId: "",
    dataDistribuicao: "",
    instancia: "",
    instanciaOutro: "",
    areaAtuacaoId: "",
    tipoProcessoId: "",
    sistemaCnjId: "",
    monitorarProcesso: false,
});

const normalizeDateInputValue = (value: unknown): string => {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return parsed.toISOString().slice(0, 10);
};

const parseBooleanInput = (value: unknown): boolean => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        if (normalized === "true" || normalized === "1" || normalized === "sim") {
            return true;
        }

        if (normalized === "false" || normalized === "0" || normalized === "nao" || normalized === "não") {
            return false;
        }
    }

    return false;
};

const mapProcessoDetailToFormState = (
    processo: Record<string, unknown>,
): { form: ProcessFormState; grau: string } => {
    const numeroValue =
        typeof processo.numero === "string" ? formatProcessNumber(processo.numero) : "";

    const ufValue = (() => {
        if (typeof processo.uf === "string") {
            const trimmed = processo.uf.trim().toUpperCase();
            if (trimmed) {
                return trimmed;
            }
        }

        if (typeof processo.jurisdicao === "string") {
            const normalized = processo.jurisdicao.trim();
            if (!normalized) {
                return "";
            }

            const separators = ["-", "/"];
            for (const separator of separators) {
                const parts = normalized.split(separator);
                if (parts.length < 2) {
                    continue;
                }

                for (let index = parts.length - 1; index >= 0; index -= 1) {
                    const candidate = normalizeUfCandidate(parts[index]);
                    if (candidate) {
                        return candidate;
                    }
                }
            }

            const words = normalized.split(" ");
            for (let index = words.length - 1; index >= 0; index -= 1) {
                const candidate = normalizeUfCandidate(words[index]);
                if (candidate) {
                    return candidate;
                }
            }
        }

        const inferredFromNumero = inferUfFromProcessNumber(numeroValue);
        if (inferredFromNumero) {
            return inferredFromNumero;
        }

        return "";
    })();

    const municipioValue =
        typeof processo.municipio === "string" ? processo.municipio.trim() : "";

    const clienteIdValue = parseOptionalInteger(processo.cliente_id);
    const propostaIdValue = parseOptionalInteger(processo.oportunidade_id);
    const areaAtuacaoIdValue = parseOptionalInteger(processo.area_atuacao_id);
    const tipoProcessoIdValue = parseOptionalInteger(processo.tipo_processo_id);
    const sistemaCnjIdValue = parseOptionalInteger(processo.sistema_cnj_id);

    const advogadosValue = Array.isArray(processo.advogados)
        ? processo.advogados
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return null;
                }

                const candidate =
                    (item as { id?: unknown }).id ??
                    (item as { usuario_id?: unknown }).usuario_id ??
                    null;
                const parsed = parseOptionalInteger(candidate);
                return parsed && parsed > 0 ? String(parsed) : null;
            })
            .filter((value): value is string => Boolean(value))
        : [];

    const advogadosIds = Array.from(new Set(advogadosValue));

    let instanciaOutro = "";
    let instanciaSelecionada = "";

    const instanciaRaw =
        typeof processo.instancia === "string"
            ? processo.instancia.trim()
            : typeof processo.instancia === "number" && Number.isFinite(processo.instancia)
                ? String(Math.trunc(processo.instancia))
                : "";

    if (instanciaRaw) {
        const matchedOption = INSTANCIA_OPTIONS.find(
            (option) => option.toLowerCase() === instanciaRaw.toLowerCase(),
        );

        if (matchedOption) {
            instanciaSelecionada = matchedOption;
        } else {
            instanciaSelecionada = INSTANCIA_OUTRO_VALUE;
            instanciaOutro = instanciaRaw;
        }
    }

    const dataDistribuicaoValue = normalizeDateInputValue(processo.data_distribuicao);

    const monitorarProcessoValue = parseBooleanInput(processo.monitorar_processo);

    const resolvedGrau = (() => {
        if (typeof processo.grau === "string") {
            const trimmed = processo.grau.trim();
            return trimmed || "1º Grau";
        }

        if (typeof processo.grau === "number" && Number.isFinite(processo.grau)) {
            return String(Math.trunc(processo.grau));
        }

        return "1º Grau";
    })();

    const form: ProcessFormState = {
        numero: numeroValue,
        uf: ufValue,
        municipio: municipioValue,
        clienteId: clienteIdValue ? String(clienteIdValue) : "",
        advogados: advogadosIds,
        propostaId: propostaIdValue ? String(propostaIdValue) : "",
        dataDistribuicao: dataDistribuicaoValue,
        instancia: instanciaSelecionada,
        instanciaOutro,
        areaAtuacaoId: areaAtuacaoIdValue ? String(areaAtuacaoIdValue) : "",
        tipoProcessoId: tipoProcessoIdValue ? String(tipoProcessoIdValue) : "",
        sistemaCnjId: sistemaCnjIdValue ? String(sistemaCnjIdValue) : "",
        monitorarProcesso: monitorarProcessoValue,
    };

    return { form, grau: resolvedGrau };
};

const mapApiProcessoToProcesso = (processo: ApiProcesso): Processo => {
    const clienteResumo = processo.cliente ?? null;
    const clienteId =
        parseOptionalInteger(clienteResumo?.id) ??
        parseOptionalInteger(processo.cliente_id) ??
        0;
    const empresaId = parseOptionalInteger(processo.idempresa);
    const documento = clienteResumo?.documento ?? "";
    let jurisdicao =
        processo.jurisdicao ||
        [processo.municipio, processo.uf].filter(Boolean).join(" - ") ||
        "Não informado";

    const oportunidadeResumo = processo.oportunidade ?? null;
    const oportunidadeId = parseOptionalInteger(
        processo.oportunidade_id ?? oportunidadeResumo?.id ?? null,
    );
    const oportunidadeSequencial = parseOptionalInteger(
        oportunidadeResumo?.sequencial_empresa,
    );
    const oportunidadeDataCriacao =
        typeof oportunidadeResumo?.data_criacao === "string"
            ? oportunidadeResumo?.data_criacao
            : null;
    const oportunidadeSolicitante =
        typeof oportunidadeResumo?.solicitante_nome === "string"
            ? oportunidadeResumo.solicitante_nome
            : null;

    const advogadosResumoValue = (() => {
        if (typeof processo.advogados_resumo !== "string") {
            return null;
        }

        const trimmed = processo.advogados_resumo.trim();
        return trimmed ? trimmed : null;
    })();

    const advogadoResponsavel = (() => {
        if (typeof processo.advogado_responsavel !== "string") {
            return null;
        }

        const trimmed = processo.advogado_responsavel.trim();
        return trimmed ? trimmed : null;
    })();

    const advogados: ProcessoAdvogado[] = [];
    const seen = new Set<number>();

    if (Array.isArray(processo.advogados)) {
        for (const advogado of processo.advogados) {
            if (!advogado) {
                continue;
            }

            const idValue =
                typeof advogado.id === "number"
                    ? advogado.id
                    : typeof advogado.id === "string"
                        ? Number.parseInt(advogado.id, 10)
                        : null;

            if (!idValue || !Number.isFinite(idValue) || idValue <= 0 || seen.has(idValue)) {
                continue;
            }

            const nome =
                pickFirstNonEmptyString(advogado.nome, advogado.name, advogado.perfil_nome) ??
                `Advogado #${idValue}`;

            const funcao = pickFirstNonEmptyString(
                advogado.funcao,
                advogado.cargo,
                advogado.perfil,
                advogado.perfil_nome,
            );

            const oab = pickFirstNonEmptyString(advogado.oab);

            advogados.push({ id: idValue, nome, funcao, oab });
            seen.add(idValue);
        }
    }

    if (advogados.length === 0) {
        if (advogadoResponsavel) {
            advogados.push({ id: 0, nome: advogadoResponsavel, oab: null });
        }
    }

    advogados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const proposta: ProcessoProposta | null =
        oportunidadeId && oportunidadeId > 0
            ? {
                id: oportunidadeId,
                label: formatPropostaLabel(
                    oportunidadeId,
                    oportunidadeSequencial,
                    oportunidadeDataCriacao,
                    oportunidadeSolicitante,
                ),
                solicitante: oportunidadeSolicitante ?? null,
            }
            : null;

    const statusLabel = processo.status?.trim() || "Não informado";

    const tipo = processo.tipo?.trim() || "Não informado";
    const classeJudicial = processo.classe_judicial?.trim() || "Não informada";
    const assunto = processo.assunto?.trim() || "Não informado";
    const orgaoJulgador = processo.orgao_julgador?.trim() || "Não informado";

    const lastSyncAt = processo.ultima_sincronizacao ?? null;

    const ultimaMovimentacaoData = (() => {
        // Primeiro tenta usar o campo de data dedicado (vindo de pje_processos.ultimo_movimento_data)
        if (typeof processo.ultima_movimentacao_data === "string") {
            const trimmed = processo.ultima_movimentacao_data.trim();
            if (trimmed) {
                return trimmed;
            }
        }

        return null;
    })();

    const ultimaMovimentacaoTipo = (() => {
        if (typeof processo.ultima_movimentacao_tipo !== "string") {
            return null;
        }

        const trimmed = processo.ultima_movimentacao_tipo.trim();
        return trimmed ? trimmed : null;
    })();

    const ultimaMovimentacaoDescricao = (() => {
        // Usa ultima_movimentacao_descricao ou ultima_movimentacao como descrição textual
        if (typeof processo.ultima_movimentacao_descricao === "string") {
            const trimmed = processo.ultima_movimentacao_descricao.trim();
            if (trimmed) {
                return trimmed;
            }
        }

        if (typeof processo.ultima_movimentacao === "string") {
            const trimmed = processo.ultima_movimentacao.trim();
            if (trimmed) {
                return trimmed;
            }
        }

        return null;
    })();

    let ultimaMovimentacao = formatDateToPtBR(ultimaMovimentacaoData);

    if (
        ultimaMovimentacao === "Não informado" &&
        typeof processo.ultima_movimentacao === "string"
    ) {
        const fallback = processo.ultima_movimentacao.trim();
        if (fallback) {
            ultimaMovimentacao = fallback;
        }
    }

    const movimentacoesCount = Math.max(
        parseApiInteger(processo.movimentacoes_count),
        0,
    );

    const consultasApiCount = Math.max(
        parseApiInteger(processo.consultas_api_count),
        0,
    );

    const grauValue = (() => {
        if (typeof processo.grau === "string") {
            const trimmed = processo.grau.trim();
            if (trimmed) {
                return trimmed;
            }
        }

        if (typeof processo.grau === "number" && Number.isFinite(processo.grau)) {
            const normalized = String(Math.trunc(processo.grau));
            if (normalized) {
                return normalized;
            }
        }

        return null;
    })();

    return {
        id: processo.id,
        numero: processo.numero,
        dataDistribuicao:
            formatDateToPtBR(processo.data_distribuicao || processo.criado_em),
        status: statusLabel,
        tipo,
        cliente: {
            id: clienteId,
            nome: clienteResumo?.nome ?? "Cliente não informado",
            documento: documento,
            papel: resolveClientePapel(clienteResumo?.tipo),
        },
        advogados,
        advogadosResumo: advogadosResumoValue,
        advogadoResponsavel,
        classeJudicial,
        assunto,
        jurisdicao,
        orgaoJulgador,
        proposta,
        ultimaSincronizacao: lastSyncAt,
        ultimaMovimentacao,
        ultimaMovimentacaoData: ultimaMovimentacaoData,
        ultimaMovimentacaoTipo,
        ultimaMovimentacaoDescricao,
        consultasApiCount,
        movimentacoesCount,
        grau: grauValue,
        idempresa: empresaId ?? null,
        nao_lido: Boolean(processo.nao_lido),
        idusuario_leitura: parseOptionalInteger(processo.idusuario_leitura),
        lido_em:
            typeof processo.lido_em === "string" && processo.lido_em.trim()
                ? processo.lido_em
                : null,
    };
};

const ARQUIVADO_KEYWORDS = ["arquiv", "baix", "encerr", "finaliz", "transit", "extint"];

const markProcessoAsRead = async (
    id: number | string,
): Promise<MarkProcessoAsReadResponse> => {
    const response = await fetch(getApiUrl(`processos/${id}/read`), {
        method: "PATCH",
        headers: { Accept: "application/json" },
    });

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch (error) {
        console.error("Não foi possível interpretar a resposta ao marcar processo como lido", error);
    }

    if (!response.ok) {
        const message =
            payload &&
                typeof payload === "object" &&
                "error" in payload &&
                typeof (payload as { error?: unknown }).error === "string"
                ? String((payload as { error: string }).error)
                : `Não foi possível marcar o processo como lido (HTTP ${response.status})`;
        throw new Error(message);
    }

    if (!payload || typeof payload !== "object") {
        throw new Error("Resposta inválida do servidor ao marcar processo como lido");
    }

    const record = payload as Record<string, unknown>;
    const idValue = parseOptionalInteger(record["id"]);

    if (!idValue) {
        throw new Error("Resposta inválida do servidor ao marcar processo como lido");
    }

    const naoLidoValue = Boolean(record["nao_lido"]);
    const leitorId = parseOptionalInteger(record["idusuario_leitura"]);
    const lidoEmValue =
        typeof record["lido_em"] === "string" && record["lido_em"].trim()
            ? (record["lido_em"] as string)
            : null;
    const atualizadoEmValue =
        typeof record["atualizado_em"] === "string" && record["atualizado_em"].trim()
            ? (record["atualizado_em"] as string)
            : null;

    return {
        id: idValue,
        nao_lido: naoLidoValue,
        idusuario_leitura: leitorId,
        lido_em: lidoEmValue,
        atualizado_em: atualizadoEmValue,
    };
};

const normalizeStatusForSummary = (status: string) =>
    status
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

const computeProcessosSummary = (itens: Processo[]): ProcessoSummary => {
    let andamento = 0;
    let arquivados = 0;
    let totalSincronizacoes = 0;
    const clientes = new Set<number>();
    const statusSet = new Set<string>();
    const tipoSet = new Set<string>();

    itens.forEach((processo) => {
        const statusValue = processo.status?.trim() || "Não informado";
        if (statusValue.toLowerCase() !== "não informado") {
            statusSet.add(statusValue);
        }

        const normalizedStatus = normalizeStatusForSummary(statusValue);
        if (normalizedStatus && ARQUIVADO_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))) {
            arquivados += 1;
        } else {
            andamento += 1;
        }

        const tipoValue = processo.tipo?.trim() || "Não informado";
        if (tipoValue.toLowerCase() !== "não informado") {
            tipoSet.add(tipoValue);
        }

        if (processo.cliente?.id) {
            clientes.add(processo.cliente.id);
        }

        totalSincronizacoes += processo.consultasApiCount;
    });

    return {
        andamento,
        arquivados,
        clientes: clientes.size,
        totalSincronizacoes,
        statusOptions: Array.from(statusSet).sort((a, b) => a.localeCompare(b)),
        tipoOptions: Array.from(tipoSet).sort((a, b) => a.localeCompare(b)),
    };
};

const normalizarNumeroProcesso = (numero: string) => numero.replace(/\D/g, "");

export interface ProcessoRelacionadoMesmoNumeroResumo {
    id: number;
    numero: string;
    cliente: string;
    status: string;
    instancia: string | null;
}

const PROCESSOS_RELACIONADOS_STORAGE_KEY = "processos-relacionados-por-numero";

const gerarChaveAgrupamentoProcesso = (numero: string, id: number): string => {
    const normalizado = normalizarNumeroProcesso(numero);
    const fallback = numero.trim() || String(id);
    return normalizado || fallback;
};

const mapProcessoParaResumoRelacionado = (processo: Processo): ProcessoRelacionadoMesmoNumeroResumo => ({
    id: processo.id,
    numero: processo.numero,
    cliente: processo.cliente?.nome ?? "Cliente não informado",
    status: processo.status ?? "Não informado",
    instancia: processo.grau ?? processo.jurisdicao ?? null,
});

const armazenarRelacionadosMesmoNumero = (agrupados: Record<string, Processo[]>): void => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        const payload = Object.fromEntries(
            Object.entries(agrupados).map(([chave, lista]) => [
                chave,
                lista.map(mapProcessoParaResumoRelacionado),
            ]),
        );

        window.sessionStorage.setItem(PROCESSOS_RELACIONADOS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error("Não foi possível armazenar os processos relacionados", error);
    }
};

const limparRelacionadosMesmoNumero = (): void => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.removeItem(PROCESSOS_RELACIONADOS_STORAGE_KEY);
    } catch (error) {
        console.error("Não foi possível limpar os processos relacionados", error);
    }
};

const agruparProcessosPorNumero = (itens: Processo[]): Map<string, Processo[]> => {
    const mapa = new Map<string, Processo[]>();

    itens.forEach((processo) => {
        const chave = gerarChaveAgrupamentoProcesso(processo.numero, processo.id);
        const existentes = mapa.get(chave);

        if (existentes) {
            existentes.push(processo);
            return;
        }

        mapa.set(chave, [processo]);
    });

    return mapa;
};

const unificarProcessosPorNumero = (itens: Processo[]): Processo[] => {
    return Array.from(agruparProcessosPorNumero(itens).values()).map((lista) => lista[0]);
};

const getStatusBadgeClassName = (status: string) => {
    const normalized = status.toLowerCase();

    if (normalized.includes("andamento") || normalized.includes("ativo")) {
        return "border-emerald-200 bg-emerald-500/10 text-emerald-600";
    }

    if (normalized.includes("arquiv")) {
        return "border-slate-200 bg-slate-500/10 text-slate-600";
    }

    if (normalized.includes("urg")) {
        return "border-amber-200 bg-amber-500/10 text-amber-600";
    }

    return "border-primary/20 bg-primary/5 text-primary";
};

const getTipoBadgeClassName = (tipo: string) => {
    if (!tipo || tipo.toLowerCase() === "não informado") {
        return "border-muted-foreground/20 bg-muted text-muted-foreground";
    }

    return "border-blue-200 bg-blue-500/10 text-blue-600";
};

export default function Processos() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { plan } = usePlan();
    const initialLoggedUserOab = useMemo(() => getLoggedLawyerOab(user), [user]);
    const [loggedUserOabNumero, setLoggedUserOabNumero] = useState(
        () => initialLoggedUserOab.numero,
    );
    const [loggedUserOabUf, setLoggedUserOabUf] = useState(() => initialLoggedUserOab.uf);
    const [loggedUserOabRequested, setLoggedUserOabRequested] = useState(false);
    const loggedUserId = useMemo(() => {
        if (!user || typeof user !== "object") {
            return null;
        }
        const record = user as unknown as Record<string, unknown>;
        const idCandidate = record["id"];
        if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) {
            return Math.trunc(idCandidate);
        }
        if (typeof idCandidate === "string") {
            const trimmed = idCandidate.trim();
            if (!trimmed) {
                return null;
            }
            const parsed = Number.parseInt(trimmed, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }, [user]);

    useEffect(() => {
        setLoggedUserOabNumero(initialLoggedUserOab.numero);
        setLoggedUserOabUf(initialLoggedUserOab.uf);
    }, [initialLoggedUserOab.numero, initialLoggedUserOab.uf]);

    useEffect(() => {
        setLoggedUserOabRequested(false);
    }, [loggedUserId]);

    useEffect(() => {
        if (!loggedUserId) {
            return;
        }
        if (loggedUserOabNumero && loggedUserOabUf) {
            return;
        }
        if (loggedUserOabRequested) {
            return;
        }
        setLoggedUserOabRequested(true);
        const controller = new AbortController();
        const loadProfile = async () => {
            try {
                const profile = await fetchMeuPerfil({ signal: controller.signal });
                setLoggedUserOabNumero((current) => current ?? profile.oabNumber ?? null);
                setLoggedUserOabUf((current) => current ?? profile.oabUf ?? null);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                console.error("Falha ao carregar OAB do usuário autenticado", error);
            }
        };
        void loadProfile();
        return () => {
            controller.abort();
        };
    }, [loggedUserId, loggedUserOabNumero, loggedUserOabUf, loggedUserOabRequested]);
    const [processos, setProcessos] = useState<Processo[]>([]);
    const [processosPorNumero, setProcessosPorNumero] = useState<Record<string, Processo[]>>({});
    const [markingProcessoId, setMarkingProcessoId] = useState<number | null>(null);
    const [bulkMarkingProcessos, setBulkMarkingProcessos] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("todos");
    const [tipoFilter, setTipoFilter] = useState("todos");
    const [naoLidoFilter, setNaoLidoFilter] = useState("todos");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isOabModalOpen, setIsOabModalOpen] = useState(false);
    const [oabModalDismissed, setOabModalDismissed] = useState(false);
    const [oabUf, setOabUf] = useState("");
    const [oabNumero, setOabNumero] = useState("");
    const [oabDiasSemana, setOabDiasSemana] = useState<number[]>(DEFAULT_MONITOR_DAYS);
    const [oabSyncFromMode, setOabSyncFromMode] = useState<"all" | "date">("all");
    const [oabSyncFromDate, setOabSyncFromDate] = useState<Date | null>(null);
    const [oabSyncFromCalendarOpen, setOabSyncFromCalendarOpen] = useState(false);
    const [oabMonitors, setOabMonitors] = useState<OabMonitor[]>([]);
    const [oabMonitorsLoading, setOabMonitorsLoading] = useState(false);
    const [oabMonitorsInitialized, setOabMonitorsInitialized] = useState(false);
    const [oabMonitorsError, setOabMonitorsError] = useState<string | null>(null);
    const [oabSubmitLoading, setOabSubmitLoading] = useState(false);
    const [oabSyncingProcesses, setOabSyncingProcesses] = useState(false);
    const [syncingAll, setSyncingAll] = useState(false);
    const [oabSubmitError, setOabSubmitError] = useState<ReactNode | null>(null);
    const [oabUsuarioOptions, setOabUsuarioOptions] = useState<OabUsuarioOption[]>([]);
    const [oabUsuariosLoading, setOabUsuariosLoading] = useState(false);
    const [oabUsuariosError, setOabUsuariosError] = useState<string | null>(null);
    const [oabUsuarioId, setOabUsuarioId] = useState("");
    const [oabRemovingId, setOabRemovingId] = useState<number | null>(null);
    const [processForm, setProcessForm] = useState<ProcessFormState>(
        createEmptyProcessForm,
    );
    const [advogadosOptions, setAdvogadosOptions] = useState<AdvogadoOption[]>([]);
    const [advogadosLoading, setAdvogadosLoading] = useState(false);
    const [advogadosError, setAdvogadosError] = useState<string | null>(null);
    const [advogadosPopoverOpen, setAdvogadosPopoverOpen] = useState(false);
    const [propostas, setPropostas] = useState<PropostaOption[]>([]);
    const [propostasLoading, setPropostasLoading] = useState(false);
    const [propostasError, setPropostasError] = useState<string | null>(null);
    const [propostasPopoverOpen, setPropostasPopoverOpen] = useState(false);
    const [areaOptions, setAreaOptions] = useState<SimpleOption[]>([]);
    const [areaLoading, setAreaLoading] = useState(false);
    const [areaError, setAreaError] = useState<string | null>(null);
    const [areaPopoverOpen, setAreaPopoverOpen] = useState(false);
    const [tipoProcessoOptions, setTipoProcessoOptions] = useState<SimpleOption[]>([]);
    const [tipoProcessoLoading, setTipoProcessoLoading] = useState(false);
    const [tipoProcessoError, setTipoProcessoError] = useState<string | null>(null);
    const [tipoProcessoPopoverOpen, setTipoProcessoPopoverOpen] = useState(false);
    const [sistemaOptions, setSistemaOptions] = useState<SimpleOption[]>([]);
    const [sistemaLoading, setSistemaLoading] = useState(false);
    const [sistemaError, setSistemaError] = useState<string | null>(null);
    const [sistemaPopoverOpen, setSistemaPopoverOpen] = useState(false);
    const [ufs, setUfs] = useState<Uf[]>([]);
    const [ufOptions, setUfOptions] = useState<{ sigla: string; nome: string }[]>([]);
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [municipiosLoading, setMunicipiosLoading] = useState(false);
    const [municipioPopoverOpen, setMunicipioPopoverOpen] = useState(false);
    const [clientes, setClientes] = useState<ClienteResumo[]>([]);
    const [clientesLoading, setClientesLoading] = useState(false);
    const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
    const [processosLoading, setProcessosLoading] = useState(false);
    const [processosError, setProcessosError] = useState<string | null>(null);
    const [totalProcessos, setTotalProcessos] = useState(0);
    const [processosEmAndamento, setProcessosEmAndamento] = useState(0);
    const [processosArquivados, setProcessosArquivados] = useState(0);
    const [clientesAtivos, setClientesAtivos] = useState(0);
    const [totalSincronizacoes, setTotalSincronizacoes] = useState(0);
    const [totalPrimeiraInstancia, setTotalPrimeiraInstancia] = useState(0);
    const [totalSegundaInstancia, setTotalSegundaInstancia] = useState(0);
    const [statusOptions, setStatusOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [createError, setCreateError] = useState<string | null>(null);
    const [creatingProcess, setCreatingProcess] = useState(false);
    const [viewingProcessId, setViewingProcessId] = useState<number | null>(null);
    const viewProcessTimeoutRef = useRef<number | null>(null);
    const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
    const [editingProcessGrau, setEditingProcessGrau] = useState<string | null>(null);
    const [loadingProcessForm, setLoadingProcessForm] = useState(false);
    const [unassignedProcessIds, setUnassignedProcessIds] = useState<number[]>([]);
    const [unassignedDetails, setUnassignedDetails] = useState<
        Record<number, UnassignedProcessDetail>
    >({});
    const [unassignedModalOpen, setUnassignedModalOpen] = useState(false);
    const [unassignedClientPopoverOpenId, setUnassignedClientPopoverOpenId] = useState<
        number | null
    >(null);
    const [unassignedMunicipioPopoverOpenId, setUnassignedMunicipioPopoverOpenId] =
        useState<number | null>(null);
    const [unassignedMunicipiosByUf, setUnassignedMunicipiosByUf] = useState<
        Record<string, Municipio[]>
    >({});
    const [unassignedMunicipiosLoadingUf, setUnassignedMunicipiosLoadingUf] =
        useState<string | null>(null);
    const [unassignedMunicipiosErrorByUf, setUnassignedMunicipiosErrorByUf] = useState<
        Record<string, string>
    >({});
    const [unassignedModalDismissed, setUnassignedModalDismissed] = useState(false);
    const [unassignedLoading, setUnassignedLoading] = useState(false);
    const [unassignedError, setUnassignedError] = useState<string | null>(null);
    const [hasUnassignedOnCurrentPage, setHasUnassignedOnCurrentPage] = useState(false);
    const [unassignedProcesses, setUnassignedProcesses] = useState<Processo[]>([]);
    const [unassignedTotal, setUnassignedTotal] = useState(0);
    const [unassignedPage, setUnassignedPage] = useState(1);

    const processNumberSearch = useMemo(() => {
        const digits = searchTerm.replace(/\D/g, "");
        return digits.length > 0 ? digits : null;
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter, tipoFilter, naoLidoFilter]);

    useEffect(() => {
        return () => {
            if (viewProcessTimeoutRef.current !== null) {
                window.clearTimeout(viewProcessTimeoutRef.current);
                viewProcessTimeoutRef.current = null;
            }
        };
    }, []);

    const adjustUnreadProcessosCounter = useCallback(
        (delta: number) => {
            if (!delta) {
                return;
            }

            queryClient.setQueryData<number>(["sidebar", "unread", "processos"], (prev) => {
                const current =
                    typeof prev === "number" && Number.isFinite(prev) ? Math.trunc(prev) : 0;
                const next = current + delta;
                return next > 0 ? next : 0;
            });
        },
        [queryClient],
    );

    const applyProcessosData = useCallback((data: ProcessoLoadResult) => {
        const agrupados = data.agrupadosPorNumero ?? {};

        setProcessos(data.items);
        setTotalProcessos(data.total);
        setProcessosEmAndamento(data.summary.andamento);
        setProcessosArquivados(data.summary.arquivados);
        setClientesAtivos(data.summary.clientes);
        setTotalSincronizacoes(data.summary.totalSincronizacoes);
        setTotalSincronizacoes(data.summary.totalSincronizacoes);
        setTotalPrimeiraInstancia(data.summary.totalPrimeiraInstancia ?? 0);
        setTotalSegundaInstancia(data.summary.totalSegundaInstancia ?? 0);
        setStatusOptions(data.summary.statusOptions);
        setTipoOptions(data.summary.tipoOptions);
        setProcessosPorNumero(agrupados);
        armazenarRelacionadosMesmoNumero(agrupados);
    }, []);

    const applyProcessoReadUpdates = useCallback(
        (updates: Map<number, MarkProcessoAsReadResponse>) => {
            if (updates.size === 0) {
                return;
            }

            const applyUpdate = (processo: Processo): Processo => {
                const update = updates.get(processo.id);
                if (!update) {
                    return processo;
                }

                const nextNaoLido = Boolean(update.nao_lido);
                const nextReaderId = update.idusuario_leitura ?? null;
                const nextReadAt = update.lido_em ?? null;

                if (
                    processo.nao_lido === nextNaoLido &&
                    processo.idusuario_leitura === nextReaderId &&
                    processo.lido_em === nextReadAt
                ) {
                    return processo;
                }

                return {
                    ...processo,
                    nao_lido: nextNaoLido,
                    idusuario_leitura: nextReaderId,
                    lido_em: nextReadAt,
                };
            };

            let unreadDelta = 0;

            setProcessos((prev) =>
                prev.map((processo) => {
                    const updated = applyUpdate(processo);
                    if (processo !== updated && processo.nao_lido !== updated.nao_lido) {
                        unreadDelta += updated.nao_lido ? 1 : -1;
                    }
                    return updated;
                }),
            );

            setProcessosPorNumero((prev) => {
                if (!prev || Object.keys(prev).length === 0) {
                    return prev;
                }

                let changed = false;
                const next: Record<string, Processo[]> = {};

                for (const [key, lista] of Object.entries(prev)) {
                    let listChanged = false;
                    const nextList = lista.map((item) => {
                        const updated = applyUpdate(item);
                        if (updated !== item) {
                            listChanged = true;
                        }
                        return updated;
                    });

                    next[key] = listChanged ? nextList : lista;
                    if (listChanged) {
                        changed = true;
                    }
                }

                if (!changed) {
                    return prev;
                }

                armazenarRelacionadosMesmoNumero(next);
                return next;
            });

            setUnassignedProcesses((prev) => prev.map(applyUpdate));

            setUnassignedDetails((prev) => {
                let changed = false;
                const next = { ...prev } as Record<number, UnassignedProcessDetail>;

                for (const [key, detail] of Object.entries(prev)) {
                    if (!detail) {
                        continue;
                    }

                    const idValue = Number.parseInt(key, 10);
                    if (!Number.isFinite(idValue)) {
                        continue;
                    }

                    const updatedProcess = applyUpdate(detail.process);
                    if (updatedProcess !== detail.process) {
                        next[idValue] = { ...detail, process: updatedProcess };
                        changed = true;
                    }
                }

                return changed ? next : prev;
            });

            if (unreadDelta !== 0) {
                adjustUnreadProcessosCounter(unreadDelta);
            }
        },
        [
            adjustUnreadProcessosCounter,
            setProcessos,
            setProcessosPorNumero,
            setUnassignedProcesses,
            setUnassignedDetails,
        ],
    );

    const applyProcessoReadUpdate = useCallback(
        (update: MarkProcessoAsReadResponse) => {
            applyProcessoReadUpdates(new Map([[update.id, update]]));
        },
        [applyProcessoReadUpdates],
    );

    const loadProcessos = useCallback(
        async (
            options?: {
                signal?: AbortSignal;
                page?: number;
                pageSize?: number;
                searchParams?: Record<string, string | number | boolean | null | undefined>;
            },
        ): Promise<ProcessoLoadResult> => {
            const currentPage = options?.page ?? page;
            const currentPageSize = options?.pageSize ?? pageSize;

            const url = new URL(getApiUrl("processos"));
            url.searchParams.set("page", String(currentPage));
            url.searchParams.set("pageSize", String(currentPageSize));

            const trimmedSearchTerm = searchTerm.trim();

            if (trimmedSearchTerm) {
                url.searchParams.set("search", trimmedSearchTerm);
            }

            if (statusFilter !== "todos") {
                url.searchParams.set("status", statusFilter);
            }

            if (tipoFilter !== "todos") {
                url.searchParams.set("tipo", tipoFilter);
            }

            if (naoLidoFilter !== "todos") {
                url.searchParams.set("nao_lido", naoLidoFilter === "nao_lidos" ? "true" : "false");
            }

            if (options?.searchParams) {
                Object.entries(options.searchParams).forEach(([key, value]) => {
                    if (value === undefined || value === null) {
                        return;
                    }

                    url.searchParams.set(key, String(value));
                });
            }

            const res = await fetch(url.toString(), {
                headers: { Accept: "application/json" },
                signal: options?.signal,
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de processos", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" &&
                        "error" in json &&
                        typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : `Não foi possível carregar os processos (HTTP ${res.status})`;
                throw new Error(message);
            }

            const rawData: unknown[] = Array.isArray(json)
                ? json
                : Array.isArray((json as { rows?: unknown[] })?.rows)
                    ? ((json as { rows: unknown[] }).rows)
                    : Array.isArray((json as { data?: { rows?: unknown[] } })?.data?.rows)
                        ? ((json as { data: { rows: unknown[] } }).data.rows)
                        : Array.isArray((json as { data?: unknown[] })?.data)
                            ? ((json as { data: unknown[] }).data)
                            : [];

            const data = rawData.filter(
                (item): item is ApiProcesso => item !== null && typeof item === "object",
            );

            const mapped = data.map(mapApiProcessoToProcesso);
            const agrupadosMapa = agruparProcessosPorNumero(mapped);
            const unificados = Array.from(agrupadosMapa.values()).map((lista) => lista[0]);
            const duplicadosNoLote = mapped.length - unificados.length;
            const agrupadosPorNumero = Object.fromEntries(agrupadosMapa.entries());

            const headerTotal = Number.parseInt(res.headers.get("x-total-count") ?? "", 10);
            const payload = json as { total?: unknown; summary?: unknown };

            const payloadTotal = (() => {
                if (typeof payload?.total === "number" && Number.isFinite(payload.total)) {
                    return payload.total;
                }

                if (typeof payload?.total === "string") {
                    const parsed = Number.parseInt(payload.total, 10);
                    return Number.isFinite(parsed) ? parsed : undefined;
                }

                return undefined;
            })();

            const totalAjustadoPayload =
                typeof payloadTotal === "number"
                    ? Math.max(0, payloadTotal - duplicadosNoLote)
                    : undefined;

            const totalAjustadoHeader = Number.isFinite(headerTotal)
                ? Math.max(0, headerTotal - duplicadosNoLote)
                : undefined;

            const total =
                typeof totalAjustadoPayload === "number"
                    ? totalAjustadoPayload
                    : typeof totalAjustadoHeader === "number"
                        ? totalAjustadoHeader
                        : unificados.length;

            const summaryPayload =
                payload?.summary && typeof payload.summary === "object"
                    ? (payload.summary as Partial<ProcessoSummary>)
                    : undefined;

            const fallbackSummary = computeProcessosSummary(unificados);

            const ensureStringArray = (value: unknown): string[] | undefined => {
                if (!Array.isArray(value)) {
                    return undefined;
                }

                const filtered = value.filter((item): item is string => typeof item === "string");
                if (filtered.length !== value.length) {
                    return undefined;
                }

                return filtered.slice().sort((a, b) => a.localeCompare(b));
            };

            const summary: ProcessoSummary = {
                andamento:
                    typeof summaryPayload?.andamento === "number"
                        ? summaryPayload.andamento
                        : fallbackSummary.andamento,
                arquivados:
                    typeof summaryPayload?.arquivados === "number"
                        ? summaryPayload.arquivados
                        : fallbackSummary.arquivados,
                clientes:
                    typeof summaryPayload?.clientes === "number"
                        ? summaryPayload.clientes
                        : fallbackSummary.clientes,
                totalSincronizacoes:
                    typeof summaryPayload?.totalSincronizacoes === "number"
                        ? summaryPayload.totalSincronizacoes
                        : fallbackSummary.totalSincronizacoes,
                totalPrimeiraInstancia:
                    typeof summaryPayload?.totalPrimeiraInstancia === "number"
                        ? summaryPayload.totalPrimeiraInstancia
                        : 0,
                totalSegundaInstancia:
                    typeof summaryPayload?.totalSegundaInstancia === "number"
                        ? summaryPayload.totalSegundaInstancia
                        : 0,
                statusOptions:
                    ensureStringArray(summaryPayload?.statusOptions) ?? fallbackSummary.statusOptions,
                tipoOptions:
                    ensureStringArray(summaryPayload?.tipoOptions) ?? fallbackSummary.tipoOptions,
            };

            return {
                items: unificados,
                total,
                page: currentPage,
                pageSize: currentPageSize,
                summary,
                agrupadosPorNumero,
            };
        },
        [page, pageSize, processNumberSearch, searchTerm, statusFilter, tipoFilter, naoLidoFilter],
    );
    useEffect(() => {
        let cancelled = false;

        const fetchUfs = async () => {
            try {
                const response = await fetch(
                    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
                );

                if (!response.ok) {
                    throw new Error("Falha ao carregar UFs");
                }

                const data = (await response.json()) as Uf[];

                if (!cancelled) {
                    setUfs(data);
                }
            } catch (error) {
                console.error("Erro ao carregar lista de UFs", error);

                if (!cancelled) {
                    setUfs([]);
                }
            }
        };

        fetchUfs();

        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        let cancelled = false;

        const fetchMonitors = async () => {
            setOabMonitorsLoading(true);
            setOabMonitorsError(null);

            try {
                const res = await fetch(getApiUrl("processos/oab-monitoradas"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;

                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de OABs monitoradas", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as OABs monitoradas (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : [];

                const monitors = payloadArray
                    .map((item) => mapApiOabMonitor(item))
                    .filter((item): item is OabMonitor => item !== null);

                if (!cancelled) {
                    setOabMonitors(monitors);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setOabMonitors([]);
                    setOabMonitorsError(
                        error instanceof Error ? error.message : "Erro ao carregar OABs monitoradas",
                    );
                }
            } finally {
                if (!cancelled) {
                    setOabMonitorsLoading(false);
                    setOabMonitorsInitialized(true);
                }
            }
        };

        fetchMonitors();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!oabMonitorsInitialized) {
            return;
        }

        const toComparableNumber = (value: string | null | undefined): string | null => {
            const sanitized = sanitizeOabNumberValue(value);
            if (!sanitized) {
                return null;
            }

            const normalized = sanitized.replace(/^0+/, "");
            return normalized || "0";
        };

        const knownNumbers = new Set<string>();
        const addKnownNumber = (value: string | null | undefined) => {
            const comparable = toComparableNumber(value);
            if (comparable) {
                knownNumbers.add(comparable);
            }
        };

        addKnownNumber(initialLoggedUserOab.numero);
        addKnownNumber(loggedUserOabNumero);

        const monitorMatchesKnown = (monitor: OabMonitor): boolean => {
            if (knownNumbers.size === 0) {
                return false;
            }

            const monitorNumeroComparable = toComparableNumber(monitor.numero);
            if (monitorNumeroComparable && knownNumbers.has(monitorNumeroComparable)) {
                return true;
            }

            if (monitor.usuarioOab) {
                const monitorUsuario = extractCombinedOabData(monitor.usuarioOab);
                const monitorUsuarioComparable = toComparableNumber(monitorUsuario.numero);
                if (monitorUsuarioComparable && knownNumbers.has(monitorUsuarioComparable)) {
                    return true;
                }
            }

            return false;
        };

        const monitorByUser =
            loggedUserId !== null
                ? oabMonitors.find((monitor) => {
                    if (monitor.usuarioId !== loggedUserId) {
                        return false;
                    }

                    if (knownNumbers.size === 0) {
                        return true;
                    }

                    return monitorMatchesKnown(monitor);
                })
                : undefined;

        const matchingMonitor =
            monitorByUser ??
            (knownNumbers.size > 0
                ? oabMonitors.find((monitor) => monitorMatchesKnown(monitor))
                : undefined);

        if (!matchingMonitor) {
            return;
        }

        setLoggedUserOabNumero((current) => {
            if (current) {
                return current;
            }

            const monitorNumero = sanitizeOabNumberValue(matchingMonitor.numero);
            if (monitorNumero) {
                return monitorNumero;
            }

            if (matchingMonitor.usuarioOab) {
                const parsed = extractCombinedOabData(matchingMonitor.usuarioOab);
                if (parsed.numero) {
                    return parsed.numero;
                }
            }

            return current;
        });

        setLoggedUserOabUf((current) => {
            if (current) {
                return current;
            }

            const monitorUf = sanitizeOabUfValue(matchingMonitor.uf);
            if (monitorUf) {
                return monitorUf;
            }

            if (matchingMonitor.usuarioOab) {
                const parsed = extractCombinedOabData(matchingMonitor.usuarioOab);
                if (parsed.uf) {
                    return parsed.uf;
                }
            }

            return current;
        });
    }, [
        initialLoggedUserOab.numero,
        loggedUserId,
        loggedUserOabNumero,
        oabMonitors,
        oabMonitorsInitialized,
    ]);

    useEffect(() => {
        let cancelled = false;

        const fetchUsuariosOab = async () => {
            setOabUsuariosLoading(true);
            setOabUsuariosError(null);

            const endpoints = ["get_api_usuarios_empresa", "usuarios/empresa"];
            let loaded = false;
            let lastError: Error | null = null;

            for (const endpoint of endpoints) {
                try {
                    const res = await fetch(getApiUrl(endpoint), {
                        headers: { Accept: "application/json" },
                    });

                    let json: unknown = null;

                    try {
                        json = await res.json();
                    } catch (error) {
                        console.error("Não foi possível interpretar a resposta de usuários", error);
                    }

                    if (!res.ok) {
                        const message =
                            json && typeof json === "object" && "error" in json &&
                                typeof (json as { error?: unknown }).error === "string"
                                ? String((json as { error: string }).error)
                                : `Não foi possível carregar os usuários (HTTP ${res.status})`;
                        throw new Error(message);
                    }

                    const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                        ? (json as Record<string, unknown>[])
                        : Array.isArray((json as { data?: unknown[] })?.data)
                            ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                            : Array.isArray((json as { rows?: unknown[] })?.rows)
                                ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                                : [];

                    const options: OabUsuarioOption[] = [];
                    const seen = new Set<string>();

                    for (const item of payloadArray) {
                        if (!item) {
                            continue;
                        }

                        const idValue = parseOptionalInteger(item["id"]);

                        if (!idValue) {
                            continue;
                        }

                        const id = String(idValue);

                        if (seen.has(id)) {
                            continue;
                        }

                        const nome = pickFirstNonEmptyString(
                            typeof item["nome_completo"] === "string" ? (item["nome_completo"] as string) : undefined,
                            typeof item["nome"] === "string" ? (item["nome"] as string) : undefined,
                            typeof item["nome_usuario"] === "string" ? (item["nome_usuario"] as string) : undefined,
                            typeof item["nomeusuario"] === "string" ? (item["nomeusuario"] as string) : undefined,
                            typeof item["email"] === "string" ? getNameFromEmail(item["email"] as string) : undefined,
                        );

                        if (!nome) {
                            continue;
                        }

                        const numeroRaw = pickFirstNonEmptyString(
                            typeof item["oabNumero"] === "string" ? (item["oabNumero"] as string) : undefined,
                            typeof item["oab_numero"] === "string" ? (item["oab_numero"] as string) : undefined,
                            typeof item["oab_number"] === "string" ? (item["oab_number"] as string) : undefined,
                            typeof item["oab"] === "string" ? (item["oab"] as string) : undefined,
                        );

                        const ufRaw = pickFirstNonEmptyString(
                            typeof item["oabUf"] === "string" ? (item["oabUf"] as string) : undefined,
                            typeof item["oab_uf"] === "string" ? (item["oab_uf"] as string) : undefined,
                        );

                        let oab: string | null = null;
                        let optionNumero: string | null = null;
                        let optionUf: string | null = null;

                        if (numeroRaw) {
                            const digits = formatOabDigits(numeroRaw);
                            if (digits) {
                                optionNumero = digits;
                                if (ufRaw) {
                                    const normalizedUf = normalizeUf(ufRaw);
                                    if (normalizedUf.length === 2) {
                                        optionUf = normalizedUf;
                                        oab = formatOabDisplay(digits, normalizedUf);
                                    } else {
                                        oab = digits;
                                    }
                                } else {
                                    oab = digits;
                                }
                            }
                        }

                        if (!oab) {
                            const oabRaw = pickFirstNonEmptyString(
                                typeof item["oab"] === "string" ? (item["oab"] as string) : undefined,
                                typeof item["oabNumber"] === "string" ? (item["oabNumber"] as string) : undefined,
                            );

                            if (oabRaw) {
                                oab = oabRaw;
                                const match = oabRaw.match(/(\d{3,})/);
                                if (match) {
                                    optionNumero = formatOabDigits(match[1]);
                                }
                                const ufMatches = oabRaw.match(/([A-Za-z]{2})(?=[^A-Za-z]*\d)/g);
                                let ufCandidate: string | null = null;

                                if (ufMatches && ufMatches.length > 0) {
                                    ufCandidate = ufMatches[ufMatches.length - 1];
                                }

                                if (!ufCandidate) {
                                    const lettersAfterNumberMatches = [...oabRaw.matchAll(/\d{3,}[^A-Za-z]*([A-Za-z]{2})\b/g)];
                                    if (lettersAfterNumberMatches.length > 0) {
                                        const lastMatch = lettersAfterNumberMatches[lettersAfterNumberMatches.length - 1];
                                        ufCandidate = lastMatch[1];
                                    }
                                }

                                if (!ufCandidate) {
                                    const fallbackUfMatch = oabRaw.match(/\/\s*([A-Za-z]{2})\b/);
                                    if (fallbackUfMatch) {
                                        ufCandidate = fallbackUfMatch[1];
                                    }
                                }

                                if (ufCandidate) {
                                    const normalizedUf = normalizeUf(ufCandidate);
                                    if (normalizedUf.length === 2) {
                                        optionUf = normalizedUf;
                                    }
                                }
                            } else if (ufRaw) {
                                const normalizedUf = normalizeUf(ufRaw);
                                if (normalizedUf.length === 2) {
                                    optionUf = normalizedUf;
                                    oab = normalizedUf;
                                }
                            }
                        }

                        options.push({
                            id,
                            nome,
                            oab: oab ?? null,
                            oabNumero: optionNumero,
                            oabUf: optionUf,
                        });
                        seen.add(id);
                    }

                    options.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                    if (!cancelled) {
                        setOabUsuarioOptions(options);
                    }

                    loaded = true;
                    lastError = null;
                    break;
                } catch (error) {
                    console.error(error);
                    lastError = error instanceof Error ? error : new Error("Erro ao carregar usuários");
                }
            }

            if (!loaded && !cancelled) {
                setOabUsuarioOptions([]);
                setOabUsuariosError(lastError ? lastError.message : "Erro ao carregar usuários");
            }

            if (!cancelled) {
                setOabUsuariosLoading(false);
            }
        };

        fetchUsuariosOab();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchClientes = async () => {
            setClientesLoading(true);
            try {
                const res = await fetch(getApiUrl("clientes"), {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const data: ApiCliente[] = Array.isArray(json)
                    ? json
                    : Array.isArray((json as { rows?: ApiCliente[] })?.rows)
                        ? ((json as { rows: ApiCliente[] }).rows)
                        : Array.isArray((json as { data?: { rows?: ApiCliente[] } })?.data?.rows)
                            ? ((json as { data: { rows: ApiCliente[] } }).data.rows)
                            : Array.isArray((json as { data?: ApiCliente[] })?.data)
                                ? ((json as { data: ApiCliente[] }).data)
                                : [];
                const mapped = data
                    .filter((cliente) => typeof cliente.id === "number")
                    .map((cliente) => ({
                        id: cliente.id,
                        nome: cliente.nome ?? "Sem nome",
                        documento: cliente.documento ?? "",
                        tipo:
                            cliente.tipo === null || cliente.tipo === undefined
                                ? ""
                                : typeof cliente.tipo === "string"
                                    ? cliente.tipo
                                    : String(cliente.tipo),
                    }));
                if (!cancelled) {
                    setClientes(mapped);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setClientes([]);
                }
            } finally {
                if (!cancelled) {
                    setClientesLoading(false);
                }
            }
        };

        fetchClientes();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchAdvogados = async () => {
            setAdvogadosLoading(true);
            setAdvogadosError(null);

            try {
                const res = await fetch(getApiUrl("usuarios/empresa"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de advogados", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os advogados (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : Array.isArray((json as { rows?: unknown[] })?.rows)
                            ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                            : [];

                const options: AdvogadoOption[] = [];
                const seen = new Set<string>();

                for (const item of payloadArray) {
                    if (!item) {
                        continue;
                    }

                    const idRaw = item["id"];
                    let idValue: string | null = null;

                    if (typeof idRaw === "number" && Number.isFinite(idRaw)) {
                        idValue = String(Math.trunc(idRaw));
                    } else if (typeof idRaw === "string") {
                        const trimmed = idRaw.trim();
                        if (trimmed) {
                            idValue = trimmed;
                        }
                    }

                    if (!idValue || seen.has(idValue)) {
                        continue;
                    }

                    const nome = pickFirstNonEmptyString(
                        typeof item["nome_completo"] === "string" ? (item["nome_completo"] as string) : undefined,
                        typeof item["nome"] === "string" ? (item["nome"] as string) : undefined,
                        typeof item["nome_usuario"] === "string" ? (item["nome_usuario"] as string) : undefined,
                        typeof item["nomeusuario"] === "string" ? (item["nomeusuario"] as string) : undefined,
                        typeof item["email"] === "string" ? getNameFromEmail(item["email"] as string) : undefined,
                    );

                    if (!nome) {
                        continue;
                    }

                    const descricao = pickFirstNonEmptyString(
                        typeof item["perfil_nome"] === "string" ? (item["perfil_nome"] as string) : undefined,
                        typeof item["perfil_nome_exibicao"] === "string"
                            ? (item["perfil_nome_exibicao"] as string)
                            : undefined,
                        typeof item["funcao"] === "string" ? (item["funcao"] as string) : undefined,
                        typeof item["cargo"] === "string" ? (item["cargo"] as string) : undefined,
                    );

                    options.push({ id: idValue, nome, descricao });
                    seen.add(idValue);
                }

                options.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setAdvogadosOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setAdvogadosOptions([]);
                    setAdvogadosError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar advogados",
                    );
                }
            } finally {
                if (!cancelled) {
                    setAdvogadosLoading(false);
                }
            }
        };

        fetchAdvogados();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchTipoProcessos = async () => {
            setTipoProcessoLoading(true);
            setTipoProcessoError(null);

            const areaId = parseOptionalInteger(processForm.areaAtuacaoId);
            const path = areaId
                ? `tipo-processos?area_atuacao_id=${areaId}`
                : "tipo-processos";

            try {
                const res = await fetch(getApiUrl(path), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de tipos de processo",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os tipos de processo (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setTipoProcessoOptions(options);
                    setProcessForm((prev) => {
                        if (!prev.tipoProcessoId) {
                            return prev;
                        }

                        const exists = options.some(
                            (option) => option.id === prev.tipoProcessoId,
                        );

                        if (exists) {
                            return prev;
                        }

                        return { ...prev, tipoProcessoId: "" };
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setTipoProcessoOptions([]);
                    setTipoProcessoError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar tipos de processo",
                    );
                    setProcessForm((prev) => {
                        if (!prev.tipoProcessoId) {
                            return prev;
                        }
                        return { ...prev, tipoProcessoId: "" };
                    });
                }
            } finally {
                if (!cancelled) {
                    setTipoProcessoLoading(false);
                }
            }
        };

        fetchTipoProcessos();

        return () => {
            cancelled = true;
        };
    }, [processForm.areaAtuacaoId]);

    useEffect(() => {
        let cancelled = false;

        const fetchAreas = async () => {
            setAreaLoading(true);
            setAreaError(null);

            try {
                const res = await fetch(getApiUrl("areas"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de áreas",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as áreas de atuação (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setAreaOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setAreaOptions([]);
                    setAreaError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar áreas de atuação",
                    );
                }
            } finally {
                if (!cancelled) {
                    setAreaLoading(false);
                }
            }
        };

        fetchAreas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchSistemas = async () => {
            setSistemaLoading(true);
            setSistemaError(null);

            try {
                const res = await fetch(getApiUrl("sistemas-cnj"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de sistemas CNJ",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os sistemas judiciais (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setSistemaOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setSistemaOptions([]);
                    setSistemaError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar sistemas judiciais",
                    );
                }
            } finally {
                if (!cancelled) {
                    setSistemaLoading(false);
                }
            }
        };

        fetchSistemas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchPropostas = async () => {
            setPropostasLoading(true);
            setPropostasError(null);

            try {
                const res = await fetch(getApiUrl("oportunidades"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de propostas", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as propostas (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : Array.isArray((json as { rows?: unknown[] })?.rows)
                            ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                            : [];

                const options: PropostaOption[] = [];
                const seen = new Set<string>();

                for (const item of payloadArray) {
                    if (!item) {
                        continue;
                    }

                    const idParsed = parseOptionalInteger(item["id"]);
                    if (!idParsed || idParsed <= 0) {
                        continue;
                    }

                    const sequencialValue = parseOptionalInteger(
                        item["sequencial_empresa"],
                    );
                    const dataCriacaoValue =
                        typeof item["data_criacao"] === "string"
                            ? (item["data_criacao"] as string)
                            : null;

                    const solicitanteIdValue = parseOptionalInteger(
                        item["solicitante_id"],
                    );
                    const solicitanteId =
                        solicitanteIdValue && solicitanteIdValue > 0
                            ? String(solicitanteIdValue)
                            : null;

                    const solicitanteNome =
                        pickFirstNonEmptyString(
                            typeof item["solicitante_nome"] === "string"
                                ? (item["solicitante_nome"] as string)
                                : undefined,
                            typeof (item["solicitante"] as { nome?: unknown })?.nome === "string"
                                ? ((item["solicitante"] as { nome?: string }).nome)
                                : undefined,
                        ) ?? null;

                    const idValue = String(idParsed);
                    if (seen.has(idValue)) {
                        continue;
                    }

                    options.push({
                        id: idValue,
                        label: formatPropostaLabel(
                            idParsed,
                            sequencialValue,
                            dataCriacaoValue,
                            solicitanteNome,
                        ),
                        solicitante: solicitanteNome,
                        sequencial: sequencialValue,
                        dataCriacao: dataCriacaoValue,
                        solicitanteId,
                    });
                    seen.add(idValue);
                }

                options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

                if (!cancelled) {
                    setPropostas(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setPropostas([]);
                    setPropostasError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar propostas",
                    );
                }
            } finally {
                if (!cancelled) {
                    setPropostasLoading(false);
                }
            }
        };

        fetchPropostas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setProcessForm((prev) => {
            const valid = prev.advogados.filter((id) =>
                advogadosOptions.some((option) => option.id === id)
            );

            if (valid.length === prev.advogados.length) {
                return prev;
            }

            return { ...prev, advogados: valid };
        });
    }, [advogadosOptions]);

    const filteredPropostas = useMemo(() => {
        if (!processForm.clienteId) {
            return propostas;
        }

        return propostas.filter(
            (proposta) => proposta.solicitanteId === processForm.clienteId,
        );
    }, [processForm.clienteId, propostas]);

    useEffect(() => {
        setProcessForm((prev) => {
            if (!prev.propostaId) {
                return prev;
            }

            const exists = filteredPropostas.some(
                (option) => option.id === prev.propostaId,
            );
            if (exists) {
                return prev;
            }

            return { ...prev, propostaId: "" };
        });
    }, [filteredPropostas]);

    const selectedAdvogados = useMemo(
        () =>
            processForm.advogados
                .map((id) => advogadosOptions.find((option) => option.id === id))
                .filter((option): option is AdvogadoOption => Boolean(option)),
        [processForm.advogados, advogadosOptions],
    );

    const selectedCliente = useMemo(
        () =>
            clientes.find((cliente) => String(cliente.id) === processForm.clienteId) ?? null,
        [processForm.clienteId, clientes],
    );

    const selectedProposta = useMemo(
        () =>
            filteredPropostas.find((option) => option.id === processForm.propostaId) ?? null,
        [processForm.propostaId, filteredPropostas],
    );

    const selectedArea = useMemo(
        () =>
            areaOptions.find((option) => option.id === processForm.areaAtuacaoId) ?? null,
        [processForm.areaAtuacaoId, areaOptions],
    );

    const selectedTipoProcesso = useMemo(
        () =>
            tipoProcessoOptions.find(
                (option) => option.id === processForm.tipoProcessoId,
            ) ?? null,
        [processForm.tipoProcessoId, tipoProcessoOptions],
    );

    const selectedSistema = useMemo(
        () =>
            sistemaOptions.find((option) => option.id === processForm.sistemaCnjId) ?? null,
        [processForm.sistemaCnjId, sistemaOptions],
    );

    const clienteButtonLabel = clientesLoading && clientes.length === 0
        ? "Carregando clientes..."
        : selectedCliente
            ? `${selectedCliente.nome}${selectedCliente.documento ? ` (${selectedCliente.documento})` : ""}`
            : clientes.length === 0
                ? "Nenhum cliente disponível"
                : "Selecione o cliente";

    const municipioButtonLabel = !processForm.uf
        ? "Selecione a UF primeiro"
        : municipiosLoading
            ? "Carregando municípios..."
            : processForm.municipio
                ? processForm.municipio
                : municipios.length === 0
                    ? "Nenhum município encontrado"
                    : "Selecione o município";


    const propostaButtonLabel = selectedProposta
        ? selectedProposta.label
        : propostasLoading && propostas.length === 0
            ? "Carregando propostas..."
            : processForm.propostaId
                ? `Proposta #${processForm.propostaId}`
                : filteredPropostas.length === 0
                    ? "Nenhuma proposta disponível"
                    : "Selecione a proposta";

    const tipoProcessoButtonLabel =
        tipoProcessoLoading && tipoProcessoOptions.length === 0
            ? "Carregando tipos..."
            : selectedTipoProcesso
                ? selectedTipoProcesso.nome
                : tipoProcessoOptions.length === 0
                    ? tipoProcessoError ?? "Nenhum tipo disponível"
                    : "Selecione o tipo de processo";

    const areaButtonLabel =
        areaLoading && areaOptions.length === 0
            ? "Carregando áreas..."
            : selectedArea
                ? selectedArea.nome
                : areaOptions.length === 0
                    ? areaError ?? "Nenhuma área disponível"
                    : "Selecione a área de atuação";

    const sistemaButtonLabel =
        sistemaLoading && sistemaOptions.length === 0
            ? "Carregando sistemas..."
            : selectedSistema
                ? selectedSistema.nome
                : sistemaOptions.length === 0
                    ? sistemaError ?? "Nenhum sistema disponível"
                    : "Selecione o sistema judicial";

    const toggleAdvogadoSelection = useCallback((id: string) => {
        setProcessForm((prev) => {
            const alreadySelected = prev.advogados.includes(id);
            const updated = alreadySelected
                ? prev.advogados.filter((advId) => advId !== id)
                : [...prev.advogados, id];

            return { ...prev, advogados: updated };
        });
    }, []);

    const handleOpenOabModal = useCallback(() => {
        setOabModalDismissed(false);
        setIsOabModalOpen(true);
    }, []);

    const handleOabModalChange = useCallback((open: boolean) => {
        setIsOabModalOpen(open);
        if (!open) {
            setOabModalDismissed(true);
            setOabSubmitError(null);
            setOabUsuarioId("");
            setOabUf("");
            setOabNumero("");
            setOabDiasSemana(DEFAULT_MONITOR_DAYS);
            setOabSyncFromMode("all");
            setOabSyncFromDate(null);
            setOabSyncFromCalendarOpen(false);
        }
    }, []);

    const handleOabUsuarioChange = useCallback(
        (value: string) => {
            setOabUsuarioId(value);
            setOabSubmitError(null);
            const option = oabUsuarioOptions.find((item) => item.id === value);
            const optionUf = option?.oabUf ?? "";
            const optionNumero = option?.oabNumero ?? "";
            setOabUf(optionUf);
            setOabNumero(optionNumero);

            const normalizedUf = normalizeUf(optionUf);
            const normalizedNumero = formatOabDigits(optionNumero);

            if (normalizedUf && normalizedNumero) {
                const existingMonitor = oabMonitors.find(
                    (monitor) =>
                        monitor.uf === normalizedUf &&
                        monitor.numero === normalizedNumero,
                );

                if (existingMonitor) {
                    const filteredDays = (existingMonitor.diasSemana ?? DEFAULT_MONITOR_DAYS)
                        .map((day) => Number(day))
                        .filter((day) => BUSINESS_DAY_SET.has(day));
                    if (filteredDays.length > 0) {
                        const uniqueDays = Array.from(new Set(filteredDays)).sort((a, b) => a - b);
                        setOabDiasSemana(uniqueDays);
                    } else {
                        setOabDiasSemana(DEFAULT_MONITOR_DAYS);
                    }

                    const parsedSyncFrom = parseSyncFromDate(existingMonitor.syncFrom);
                    if (parsedSyncFrom) {
                        setOabSyncFromMode("date");
                        setOabSyncFromDate(parsedSyncFrom);
                    } else {
                        setOabSyncFromMode("all");
                        setOabSyncFromDate(null);
                    }
                    setOabSyncFromCalendarOpen(false);
                    return;
                }
            }

            setOabDiasSemana(DEFAULT_MONITOR_DAYS);
            setOabSyncFromMode("all");
            setOabSyncFromDate(null);
            setOabSyncFromCalendarOpen(false);
        },
        [oabMonitors, oabUsuarioOptions],
    );

    const handleOabSyncFromModeChange = useCallback(
        (value: "all" | "date") => {
            setOabSyncFromMode(value);
            setOabSubmitError(null);
            if (value === "all") {
                setOabSyncFromDate(null);
                setOabSyncFromCalendarOpen(false);
            } else if (!oabSyncFromDate) {
                setOabSyncFromCalendarOpen(true);
            }
        },
        [oabSyncFromDate],
    );

    const handleOabSyncFromDateSelect = useCallback((date: Date | undefined) => {
        if (!date) {
            setOabSyncFromDate(null);
            return;
        }

        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        setOabSyncFromDate(normalized);
        setOabSyncFromMode("date");
        setOabSubmitError(null);
        setOabSyncFromCalendarOpen(false);
    }, []);

    const handleRemoveOabMonitor = useCallback(
        async (monitorId: number) => {
            setOabRemovingId(monitorId);

            try {
                const res = await fetch(getApiUrl(`processos/oab-monitoradas/${monitorId}`), {
                    method: "DELETE",
                    headers: { Accept: "application/json" },
                });

                if (res.status !== 204) {
                    let json: unknown = null;

                    try {
                        json = await res.json();
                    } catch (error) {
                        console.error("Não foi possível interpretar a resposta de exclusão de OAB", error);
                    }

                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível remover a OAB (HTTP ${res.status})`;
                    throw new Error(message);
                }

                setOabMonitors((prev) => prev.filter((item) => item.id !== monitorId));
                toast({
                    title: "OAB removida",
                    description: "Monitoramento desativado com sucesso.",
                });
            } catch (error) {
                console.error(error);
                toast({
                    title: "Erro ao remover OAB",
                    description: error instanceof Error ? error.message : "Não foi possível remover a OAB.",
                    variant: "destructive",
                });
            } finally {
                setOabRemovingId(null);
            }
        },
        [toast],
    );

    const handleParticipantToggle = useCallback((processId: number, participantId: string) => {
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            const alreadySelected = current.selectedParticipantIds.includes(participantId);
            const nextSelected = alreadySelected
                ? current.selectedParticipantIds.filter((id) => id !== participantId)
                : [...current.selectedParticipantIds, participantId];

            let nextPrimary = current.primaryParticipantId;
            if (alreadySelected) {
                if (current.primaryParticipantId === participantId) {
                    nextPrimary = nextSelected[0] ?? null;
                }
            } else if (!current.primaryParticipantId) {
                nextPrimary = participantId;
            }

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedParticipantIds: nextSelected,
                    primaryParticipantId: nextPrimary,
                },
            };
        });
    }, []);

    const handlePrimaryParticipantChange = useCallback((processId: number, participantId: string) => {
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            const alreadySelected = current.selectedParticipantIds.includes(participantId);
            const nextSelected = alreadySelected
                ? current.selectedParticipantIds
                : [...current.selectedParticipantIds, participantId];

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedParticipantIds: nextSelected,
                    primaryParticipantId: participantId,
                },
            };
        });
    }, []);

    const handleParticipantRelationshipChange = useCallback(
        (processId: number, participantId: string, value: string) => {
            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        relationshipByParticipantId: {
                            ...current.relationshipByParticipantId,
                            [participantId]: value,
                        },
                    },
                };
            });
        },
        [],
    );

    const ensureUnassignedMunicipios = useCallback(
        async (uf: string) => {
            const normalized = uf.trim().toUpperCase();
            if (!normalized) {
                return;
            }

            if (
                unassignedMunicipiosLoadingUf === normalized ||
                (unassignedMunicipiosByUf[normalized] && !unassignedMunicipiosErrorByUf[normalized])
            ) {
                return;
            }

            setUnassignedMunicipiosLoadingUf(normalized);
            setUnassignedMunicipiosErrorByUf((prev) => {
                const next = { ...prev };
                delete next[normalized];
                return next;
            });

            try {
                const res = await fetch(
                    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalized}/municipios?orderBy=nome`,
                );

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = (await res.json()) as Municipio[];

                setUnassignedMunicipiosByUf((prev) => ({
                    ...prev,
                    [normalized]: data,
                }));
            } catch (error) {
                console.error(error);
                setUnassignedMunicipiosByUf((prev) => ({
                    ...prev,
                    [normalized]: [],
                }));
                setUnassignedMunicipiosErrorByUf((prev) => ({
                    ...prev,
                    [normalized]: "Erro ao carregar municípios",
                }));
            } finally {
                setUnassignedMunicipiosLoadingUf((current) =>
                    current === normalized ? null : current,
                );
            }
        },
        [
            unassignedMunicipiosByUf,
            unassignedMunicipiosErrorByUf,
            unassignedMunicipiosLoadingUf,
        ],
    );

    const handleUnassignedUfChange = useCallback(
        (processId: number, uf: string) => {
            const normalized = uf.trim().toUpperCase();

            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                const nextMunicipio =
                    normalized === current.form.uf.trim().toUpperCase()
                        ? current.form.municipio
                        : "";

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        form: {
                            ...current.form,
                            uf: normalized,
                            municipio: nextMunicipio,
                        },
                    },
                };
            });

            if (!normalized) {
                return;
            }

            setUnassignedMunicipiosErrorByUf((prev) => {
                const next = { ...prev };
                delete next[normalized];
                return next;
            });

            void ensureUnassignedMunicipios(normalized);
        },
        [ensureUnassignedMunicipios],
    );

    const handleUnassignedMunicipioSelect = useCallback(
        (processId: number, municipio: string) => {
            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        form: {
                            ...current.form,
                            municipio,
                        },
                    },
                };
            });

            setUnassignedMunicipioPopoverOpenId((current) =>
                current === processId ? null : current,
            );
        },
        [],
    );

    const handleUnassignedMunicipioPopoverChange = useCallback(
        (processId: number, open: boolean, uf: string) => {
            setUnassignedMunicipioPopoverOpenId(open ? processId : null);

            if (open) {
                void ensureUnassignedMunicipios(uf);
            }
        },
        [ensureUnassignedMunicipios],
    );

    const handleExistingClientSelection = useCallback(
        (processId: number, clientId: string) => {
            const normalizedClientId =
                clientId === NO_EXISTING_CLIENT_SELECT_VALUE ? "" : clientId;

            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                const shouldKeepSelectedProposta =
                    Boolean(normalizedClientId) &&
                    Boolean(current.selectedPropostaId) &&
                    propostas.some(
                        (proposta) =>
                            proposta.id === current.selectedPropostaId &&
                            proposta.solicitanteId === normalizedClientId,
                    );

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        selectedExistingClientId: normalizedClientId,
                        selectedPropostaId:
                            normalizedClientId && shouldKeepSelectedProposta
                                ? current.selectedPropostaId
                                : "",
                    },
                };
            });
        },
        [propostas],
    );

    const handleSelectedPropostaChange = useCallback((processId: number, propostaId: string) => {
        const normalizedPropostaId =
            propostaId === NO_PROPOSTA_SELECT_VALUE ? "" : propostaId;
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedPropostaId: normalizedPropostaId,
                },
            };
        });
    }, []);

    const handleUnassignedModalChange = useCallback((open: boolean) => {
        setUnassignedModalOpen(open);
        if (open) {
            setUnassignedPage(1);
        } else {
            setUnassignedModalDismissed(true);
        }
    }, []);

    const handleOabSubmit = useCallback(async () => {
        if (!plan) {
            setOabSubmitError("Não foi possível verificar os limites do plano. Tente atualizar a página.");
            return;
        }

        if (plan.limits.oabs && oabMonitors.length >= plan.limits.oabs) {
            setOabSubmitError(`Você atingiu o limite de ${plan.limits.oabs} OABs monitoradas do seu plano.`);
            return;
        }

        if (!oabUsuarioId) {
            setOabSubmitError("Selecione o usuário responsável pela OAB.");
            return;
        }

        if (!oabUf || !oabNumero) {
            setOabSubmitError(
                <>
                    O responsável selecionado não possui OAB válida para monitoramento. Complemente o
                    seu cadastro{" "}
                    <Link to="/meu-perfil" className="underline">
                        clicando aqui
                    </Link>{" "}
                    para cadastrar o registro da sua OAB.
                </>,
            );
            return;
        }

        if (oabDiasSemana.length === 0) {
            setOabSubmitError("Selecione ao menos um dia da semana para sincronização.");
            return;
        }

        if (oabSyncFromMode === "date" && !oabSyncFromDate) {
            setOabSubmitError("Selecione a data inicial para sincronização.");
            return;
        }

        setOabSubmitError(null);
        setOabSubmitLoading(true);

        try {
            const syncFromPayload =
                oabSyncFromMode === "date" && oabSyncFromDate
                    ? toIsoDateString(oabSyncFromDate)
                    : null;
            const res = await fetch(getApiUrl("processos/oab-monitoradas"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    uf: oabUf,
                    numero: formatOabDigits(oabNumero),
                    usuarioId: Number.parseInt(oabUsuarioId, 10),
                    diasSemana: oabDiasSemana,
                    syncFrom: syncFromPayload,
                }),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de cadastro de OAB", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" && "error" in json &&
                        typeof (json as { error?: unknown }).error === "string"
                        ? String((json as { error: string }).error)
                        : `Não foi possível cadastrar a OAB (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error("Resposta inválida do servidor ao cadastrar a OAB.");
            }

            const monitor = mapApiOabMonitor(json as Record<string, unknown>);
            if (!monitor) {
                throw new Error("Dados retornados para a OAB são inválidos.");
            }

            setOabMonitors((prev) => {
                const filtered = prev.filter((item) => item.id !== monitor.id);
                return [monitor, ...filtered];
            });
            setOabNumero("");
            setOabUsuarioId("");
            setOabDiasSemana(DEFAULT_MONITOR_DAYS);
            setOabSyncFromMode("all");
            setOabSyncFromDate(null);
            setOabSyncFromCalendarOpen(false);
            toast({
                title: "OAB cadastrada com sucesso",
                description: `Monitoramento ativado para ${formatOabDisplay(monitor.numero, monitor.uf)}.`,
            });
            handleOabModalChange(false);
            setOabSyncingProcesses(true);
            setProcessosError(null);
            try {
                const data = await loadProcessos();
                applyProcessosData(data);
            } catch (syncError) {
                console.error(syncError);
                const message =
                    syncError instanceof Error
                        ? syncError.message
                        : "Não foi possível atualizar os processos após cadastrar a OAB.";
                setProcessosError(message);
                toast({
                    title: "Erro ao atualizar processos",
                    description: message,
                    variant: "destructive",
                });
            } finally {
                setOabSyncingProcesses(false);
            }
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error ? error.message : "Erro ao cadastrar OAB";
            setOabSubmitError(message);
            toast({
                title: "Erro ao cadastrar OAB",
                description: message,
                variant: "destructive",
            });
        } finally {
            setOabSubmitLoading(false);
        }
    }, [
        oabNumero,
        oabUf,
        oabUsuarioId,
        oabDiasSemana,
        oabSyncFromMode,
        oabSyncFromDate,
        toast,
        handleOabModalChange,
        loadProcessos,

        applyProcessosData,
        oabMonitors,
        plan,
    ]);

    const ensureClientForParticipant = useCallback(
        async (participant: ProcessoParticipantOption): Promise<number> => {
            const documentDigits = getParticipantDocumentDigits(participant);

            if (documentDigits) {
                const existing = clientes.find((cliente) => {
                    if (!cliente.documento) {
                        return false;
                    }
                    return cliente.documento.replace(/\D/g, "") === documentDigits;
                });

                if (existing) {
                    return existing.id;
                }
            }

            const nome = participant.name || "Cliente sem identificação";
            const tipo = documentDigits.length === 14 ? "J" : "F";

            const payload = {
                nome,
                tipo,
                documento: documentDigits || null,
                email: null,
                telefone: null,
                cep: null,
                rua: null,
                numero: null,
                complemento: null,
                bairro: null,
                cidade: null,
                uf: null,
                ativo: true,
            };

            const res = await fetch(getApiUrl("clientes"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de criação de cliente", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" && "error" in json &&
                        typeof (json as { error?: unknown }).error === "string"
                        ? String((json as { error: string }).error)
                        : `Não foi possível cadastrar o cliente ${nome} (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error("Resposta inválida do servidor ao cadastrar cliente");
            }

            const idValue = parseOptionalInteger((json as { id?: unknown }).id);
            if (!idValue) {
                throw new Error("Cliente criado sem identificador válido");
            }

            const documentoRetornado =
                typeof (json as { documento?: string }).documento === "string"
                    ? (json as { documento: string }).documento
                    : documentDigits;
            const tipoRetornado =
                typeof (json as { tipo?: string }).tipo === "string"
                    ? (json as { tipo: string }).tipo
                    : tipo;

            const resumo: ClienteResumo = {
                id: idValue,
                nome:
                    typeof (json as { nome?: string }).nome === "string"
                        ? (json as { nome: string }).nome
                        : nome,
                documento: documentoRetornado ?? "",
                tipo: tipoRetornado ?? tipo,
            };

            setClientes((prev) => [...prev, resumo]);

            return idValue;
        },
        [clientes],
    );

    const fetchUnassignedPage = useCallback(
        async (
            page: number,
            { signal }: { signal?: AbortSignal } = {},
        ): Promise<void> => {
            if (signal?.aborted) {
                return;
            }

            setUnassignedLoading(true);
            setUnassignedError(null);
            setUnassignedProcesses([]);
            setUnassignedProcessIds([]);

            try {
                const data = await loadProcessos({
                    page,
                    pageSize: UNASSIGNED_PAGE_SIZE,
                    signal,
                    searchParams: { semCliente: true },
                });

                if (signal?.aborted) {
                    return;
                }

                setUnassignedProcesses(data.items);
                setUnassignedProcessIds(data.items.map((item) => item.id));
                setUnassignedTotal(data.total);
            } catch (error) {
                if (signal?.aborted) {
                    return;
                }

                console.error(error);

                setUnassignedError(
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar processos sem cliente",
                );
                setUnassignedProcesses([]);
                setUnassignedProcessIds([]);
                setUnassignedTotal(0);
            } finally {
                if (!signal?.aborted) {
                    setUnassignedLoading(false);
                }
            }
        },
        [loadProcessos],
    );

    const handleLinkProcess = useCallback(
        async (processId: number) => {
            const detail = unassignedDetails[processId];
            if (!detail || detail.saving) {
                return;
            }

            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        saving: true,
                        error: null,
                    },
                };
            });

            try {
                let clienteId: number | null = null;
                const selectedExisting = parseOptionalInteger(detail.selectedExistingClientId);

                if (selectedExisting && selectedExisting > 0) {
                    clienteId = selectedExisting;
                } else if (detail.primaryParticipantId) {
                    const primaryParticipant = detail.participants.find(
                        (participant) => participant.id === detail.primaryParticipantId,
                    );

                    if (!primaryParticipant) {
                        throw new Error("Selecione um cliente principal para vincular ao processo.");
                    }

                    clienteId = await ensureClientForParticipant(primaryParticipant);
                } else {
                    throw new Error(
                        "Selecione um cliente existente ou marque um envolvido como cliente principal.",
                    );
                }

                const participantsToRegister = detail.selectedParticipantIds
                    .map((participantId) =>
                        detail.participants.find((participant) => participant.id === participantId),
                    )
                    .filter(
                        (participant): participant is ProcessoParticipantOption =>
                            Boolean(participant),
                    );

                for (const participant of participantsToRegister) {
                    if (detail.primaryParticipantId && participant.id === detail.primaryParticipantId) {
                        continue;
                    }
                    await ensureClientForParticipant(participant);
                }

                const relationshipEntries = participantsToRegister.map((participant) => {
                    const relation =
                        detail.relationshipByParticipantId[participant.id]?.trim() ||
                        getParticipantDefaultRelationship(participant);
                    return relation ? `${participant.name} (${relation})` : participant.name;
                });

                const descricaoPayload =
                    relationshipEntries.length > 0
                        ? `Clientes vinculados: ${relationshipEntries.join(", ")}`
                        : undefined;

                const advogadosPayload = detail.form.advogados
                    .map((id) => Number.parseInt(id, 10))
                    .filter((value) => Number.isFinite(value) && value > 0);

                const numeroFromForm = detail.form.numero.trim();
                const numeroFromProcess =
                    typeof detail.process.numero === "string" ? detail.process.numero.trim() : "";
                const numeroPayload = numeroFromForm || numeroFromProcess;
                if (!numeroPayload) {
                    throw new Error("Informe o número do processo antes de vincular.");
                }

                const municipioFromForm = detail.form.municipio.trim();
                const municipioFromJurisdicao = (() => {
                    const [municipio] = detail.process.jurisdicao.split("-");
                    return municipio ? municipio.trim() : "";
                })();
                const municipioPayload = municipioFromForm || municipioFromJurisdicao;
                if (!municipioPayload) {
                    throw new Error("Informe o município do processo antes de vincular.");
                }

                const ufFromForm = detail.form.uf.trim();
                const ufFromProcess = "";
                const ufFromNumero = inferUfFromProcessNumber(numeroPayload);
                const ufFromJurisdicao = (() => {
                    const raw = detail.process.jurisdicao;
                    if (typeof raw !== "string") {
                        return "";
                    }

                    const normalized = raw.trim();
                    if (!normalized) {
                        return "";
                    }

                    const separators = ["-", "/"];
                    for (const separator of separators) {
                        const parts = normalized.split(separator);
                        if (parts.length < 2) {
                            continue;
                        }

                        for (let index = parts.length - 1; index >= 0; index -= 1) {
                            const candidate = parts[index]?.trim().toUpperCase();
                            if (candidate && candidate.length === 2) {
                                return candidate;
                            }
                        }
                    }

                    const words = normalized.split(" ");
                    for (let index = words.length - 1; index >= 0; index -= 1) {
                        const candidate = words[index]?.trim().toUpperCase();
                        if (candidate && candidate.length === 2) {
                            return candidate;
                        }
                    }

                    return "";
                })();
                const ufPayload = ufFromForm || ufFromProcess || ufFromNumero || ufFromJurisdicao;
                if (!ufPayload) {
                    throw new Error("Informe a UF do processo antes de vincular.");
                }

                const grauPayload =
                    detail.grau && detail.grau.trim() ? detail.grau.trim() : "1º Grau";

                const payload: Record<string, unknown> = {
                    cliente_id: clienteId,
                    numero: numeroPayload,
                    uf: ufPayload,
                    municipio: municipioPayload,
                    advogados: advogadosPayload,
                };

                const instanciaPayload =
                    detail.form.instancia === INSTANCIA_OUTRO_VALUE
                        ? detail.form.instanciaOutro.trim()
                        : detail.form.instancia.trim();
                if (instanciaPayload) {
                    payload.instancia = instanciaPayload;
                }

                if (detail.form.dataDistribuicao.trim()) {
                    payload.data_distribuicao = detail.form.dataDistribuicao.trim();
                }

                const propostaId = parseOptionalInteger(detail.selectedPropostaId);
                if (propostaId && propostaId > 0) {
                    payload.oportunidade_id = propostaId;
                }

                const tipoProcessoId = parseOptionalInteger(detail.form.tipoProcessoId);
                if (tipoProcessoId && tipoProcessoId > 0) {
                    payload.tipo_processo_id = tipoProcessoId;
                }

                const areaAtuacaoId = parseOptionalInteger(detail.form.areaAtuacaoId);
                if (areaAtuacaoId && areaAtuacaoId > 0) {
                    payload.area_atuacao_id = areaAtuacaoId;
                }

                const sistemaId = parseOptionalInteger(detail.form.sistemaCnjId);
                if (sistemaId && sistemaId > 0) {
                    payload.sistema_cnj_id = sistemaId;
                }

                payload.monitorar_processo = detail.form.monitorarProcesso;
                payload.grau = grauPayload;

                if (descricaoPayload) {
                    payload.descricao = descricaoPayload;
                }

                const res = await fetch(getApiUrl(`processos/${processId}`), {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de atualização do processo",
                        error,
                    );
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível atualizar o processo (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const remaining = unassignedProcessIds.filter((id) => id !== processId);
                const nextTotal = Math.max(0, unassignedTotal - 1);
                const nextTotalPages =
                    nextTotal <= 0 ? 1 : Math.max(1, Math.ceil(nextTotal / UNASSIGNED_PAGE_SIZE));

                setUnassignedDetails((prev) => {
                    const next = { ...prev };
                    delete next[processId];
                    return next;
                });
                setUnassignedProcesses((prev) =>
                    prev.filter((processo) => processo.id !== processId),
                );
                setUnassignedProcessIds(remaining);
                setUnassignedTotal(nextTotal);

                toast({
                    title: "Processo atualizado",
                    description: "Cliente vinculado com sucesso.",
                });

                if (nextTotal === 0) {
                    setUnassignedModalOpen(false);
                    setUnassignedModalDismissed(true);
                } else if (remaining.length === 0) {
                    const targetPage = Math.min(unassignedPage, nextTotalPages);
                    if (targetPage !== unassignedPage) {
                        setUnassignedPage(targetPage);
                    } else {
                        void fetchUnassignedPage(targetPage);
                    }
                }

                try {
                    const data = await loadProcessos();
                    applyProcessosData(data);
                } catch (refreshError) {
                    console.error("Erro ao atualizar lista de processos", refreshError);
                }
            } catch (error) {
                console.error(error);
                const message =
                    error instanceof Error ? error.message : "Erro ao vincular processo";
                setUnassignedDetails((prev) => {
                    const current = prev[processId];
                    if (!current) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [processId]: {
                            ...current,
                            error: message,
                        },
                    };
                });
                toast({
                    title: "Erro ao vincular processo",
                    description: message,
                    variant: "destructive",
                });
            } finally {
                setUnassignedDetails((prev) => {
                    const current = prev[processId];
                    if (!current) {
                        return prev;
                    }

                    return {
                        ...prev,
                        [processId]: {
                            ...current,
                            saving: false,
                        },
                    };
                });
            }
        },
        [
            unassignedDetails,
            ensureClientForParticipant,
            toast,
            loadProcessos,
            applyProcessosData,
            unassignedProcessIds,
            unassignedTotal,
            unassignedPage,
            fetchUnassignedPage,
        ],
    );

    useEffect(() => {
        let active = true;

        const fetchProcessos = async () => {
            setProcessosLoading(true);
            setProcessosError(null);
            try {
                const data = await loadProcessos();
                if (!active) {
                    return;
                }

                if (page > 1 && data.items.length === 0 && data.total > 0) {
                    setPage((prev) => Math.max(1, prev - 1));
                    return;
                }

                applyProcessosData(data);
            } catch (error) {
                console.error(error);
                if (!active) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar processos";
                setProcessos([]);
                setProcessosPorNumero({});
                limparRelacionadosMesmoNumero();
                setTotalProcessos(0);
                setProcessosEmAndamento(0);
                setProcessosArquivados(0);
                setClientesAtivos(0);
                setTotalSincronizacoes(0);
                setStatusOptions([]);
                setTipoOptions([]);
                setProcessosError(message);
                toast({
                    title: "Erro ao carregar processos",
                    description: message,
                    variant: "destructive",
                });
            } finally {
                if (active) {
                    setProcessosLoading(false);
                }
            }
        };

        fetchProcessos();

        return () => {
            active = false;
        };
    }, [applyProcessosData, loadProcessos, page, toast]);

    useEffect(() => {
        let cancelled = false;

        const fetchUfs = async () => {
            try {
                const res = await fetch(
                    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as { sigla: string; nome: string }[];
                if (!cancelled) setUfOptions(data);
            } catch (error) {
                console.error(error);
                if (!cancelled) setUfOptions([]);
            }
        };

        fetchUfs();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const POLLING_INTERVAL = 30000;
        let cancelled = false;

        const poll = async () => {
            try {
                const data = await loadProcessos();
                if (!cancelled) {
                    if (page > 1 && data.items.length === 0 && data.total > 0) {
                        setPage((prev) => Math.max(1, prev - 1));
                        return;
                    }

                    applyProcessosData(data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Erro ao atualizar processos em segundo plano", error);
                }
            }
        };

        const intervalId = window.setInterval(() => {
            void poll();
        }, POLLING_INTERVAL);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [applyProcessosData, loadProcessos, page]);

    useEffect(() => {
        if (
            processForm.clienteId &&
            !clientes.some((cliente) => String(cliente.id) === processForm.clienteId)
        ) {
            setProcessForm((prev) => ({ ...prev, clienteId: "" }));
        }
    }, [clientes, processForm.clienteId]);

    useEffect(() => {
        if (!processForm.uf) {
            setMunicipios([]);
            setMunicipiosLoading(false);
            return;
        }

        let cancelled = false;
        setMunicipiosLoading(true);

        const fetchMunicipios = async () => {
            try {
                const res = await fetch(
                    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${processForm.uf}/municipios?orderBy=nome`,
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as Municipio[];
                if (!cancelled) setMunicipios(data);
            } catch (error) {
                console.error(error);
                if (!cancelled) setMunicipios([]);
            } finally {
                if (!cancelled) setMunicipiosLoading(false);
            }
        };

        fetchMunicipios();

        return () => {
            cancelled = true;
        };
    }, [processForm.uf]);

    useEffect(() => {
        if (!processForm.uf || municipiosLoading) {
            setMunicipioPopoverOpen(false);
        }
    }, [processForm.uf, municipiosLoading]);

    useEffect(() => {
        if (statusFilter !== "todos" && !statusOptions.includes(statusFilter)) {
            setStatusFilter("todos");
        }
    }, [statusFilter, statusOptions]);

    useEffect(() => {
        if (tipoFilter !== "todos" && !tipoOptions.includes(tipoFilter)) {
            setTipoFilter("todos");
        }
    }, [tipoFilter, tipoOptions]);

    useEffect(() => {
        const hasUnassigned = processos.some(
            (processo) => !processo.cliente?.id || processo.cliente.id <= 0,
        );
        setHasUnassignedOnCurrentPage(hasUnassigned);
    }, [processos]);

    const hasOabMonitors = oabMonitors.length > 0;

    useEffect(() => {
        if (oabMonitorsInitialized && !oabModalDismissed && !oabMonitorsLoading && !hasOabMonitors) {
            setIsOabModalOpen(true);
        }
    }, [oabMonitorsInitialized, oabModalDismissed, oabMonitorsLoading, hasOabMonitors]);

    // useEffect(() => {
    //     if (!processosLoading && hasUnassignedOnCurrentPage && !unassignedModalDismissed) {
    //         setUnassignedPage(1);
    //         setUnassignedModalOpen(true);
    //     }
    // }, [processosLoading, hasUnassignedOnCurrentPage, unassignedModalDismissed]);

    useEffect(() => {
        if (!unassignedModalOpen) {
            return;
        }

        const controller = new AbortController();

        void fetchUnassignedPage(unassignedPage, { signal: controller.signal });

        return () => {
            controller.abort();
        };
    }, [fetchUnassignedPage, unassignedModalOpen, unassignedPage]);

    useEffect(() => {
        if (!unassignedModalOpen) {
            return;
        }

        const idsToFetch = unassignedProcessIds.filter((id) => !unassignedDetails[id]);
        if (idsToFetch.length === 0) {
            return;
        }

        let cancelled = false;
        setUnassignedLoading(true);
        setUnassignedError(null);

        const fetchDetails = async () => {
            try {
                const entries = await Promise.all(
                    idsToFetch.map(async (id) => {
                        const res = await fetch(getApiUrl(`processos/${id}`), {
                            headers: { Accept: "application/json" },
                        });

                        let json: unknown = null;
                        try {
                            json = await res.json();
                        } catch (error) {
                            console.error("Não foi possível interpretar a resposta de detalhes do processo", error);
                        }

                        if (!res.ok) {
                            const message =
                                json && typeof json === "object" && "error" in json &&
                                    typeof (json as { error?: unknown }).error === "string"
                                    ? String((json as { error: string }).error)
                                    : `Não foi possível carregar os detalhes do processo (HTTP ${res.status})`;
                            throw new Error(message);
                        }

                        if (!json || typeof json !== "object") {
                            throw new Error("Resposta inválida do servidor ao carregar detalhes do processo");
                        }

                        const detail = mapProcessoDetailToFormState(json as Record<string, unknown>);
                        const participants = extractParticipantOptions(json as Record<string, unknown>);

                        const relationshipByParticipantId: Record<string, string> = {};
                        participants.forEach((participant) => {
                            const defaultRelation = getParticipantDefaultRelationship(participant);
                            if (defaultRelation) {
                                relationshipByParticipantId[participant.id] = defaultRelation;
                            }
                        });

                        return {
                            id,
                            form: detail.form,
                            grau: detail.grau,
                            participants,
                            relationshipByParticipantId,
                        };
                    }),
                );

                if (!cancelled) {
                    setUnassignedDetails((prev) => {
                        const next = { ...prev };
                        for (const entry of entries) {
                            const baseProcess = unassignedProcesses.find(
                                (processo) => processo.id === entry.id,
                            );
                            if (!baseProcess) {
                                continue;
                            }

                            next[entry.id] = {
                                process: baseProcess,
                                form: entry.form,
                                grau: entry.grau,
                                participants: entry.participants,
                                selectedExistingClientId: "",
                                selectedParticipantIds: [],
                                primaryParticipantId: null,
                                relationshipByParticipantId: entry.relationshipByParticipantId,
                                selectedPropostaId: entry.form.propostaId,
                                saving: false,
                                error: null,
                            };
                        }

                        return next;
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setUnassignedError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar detalhes dos processos sem cliente",
                    );
                }
            } finally {
                if (!cancelled) {
                    setUnassignedLoading(false);
                }
            }
        };

        void fetchDetails();

        return () => {
            cancelled = true;
        };
    }, [unassignedModalOpen, unassignedProcessIds, unassignedDetails, unassignedProcesses]);

    const totalPages = useMemo(() => {
        if (pageSize <= 0) {
            return 1;
        }

        const pages = Math.ceil(totalProcessos / pageSize);
        return Math.max(1, pages || 1);
    }, [pageSize, totalProcessos]);

    const pageStart = useMemo(() => {
        if (totalProcessos === 0 || pageSize <= 0) {
            return 0;
        }

        return (page - 1) * pageSize + 1;
    }, [page, pageSize, totalProcessos]);

    const pageEnd = useMemo(() => {
        if (totalProcessos === 0 || pageSize <= 0) {
            return 0;
        }

        return Math.min(totalProcessos, page * pageSize);
    }, [page, pageSize, totalProcessos]);

    const unassignedTotalPages = useMemo(() => {
        if (UNASSIGNED_PAGE_SIZE <= 0) {
            return 1;
        }

        if (unassignedTotal <= 0) {
            return 1;
        }

        return Math.max(1, Math.ceil(unassignedTotal / UNASSIGNED_PAGE_SIZE));
    }, [unassignedTotal]);

    const unassignedPageStart = useMemo(() => {
        if (unassignedTotal === 0) {
            return 0;
        }

        return (unassignedPage - 1) * UNASSIGNED_PAGE_SIZE + 1;
    }, [unassignedPage, unassignedTotal]);

    const unassignedPageEnd = useMemo(() => {
        if (unassignedTotal === 0) {
            return 0;
        }

        return Math.min(unassignedTotal, unassignedPage * UNASSIGNED_PAGE_SIZE);
    }, [unassignedPage, unassignedTotal]);

    const unassignedPaginationRange = useMemo(() => {
        if (unassignedTotalPages <= 1) {
            return [1];
        }

        const uniquePages = new Set<number>();
        uniquePages.add(1);
        uniquePages.add(unassignedTotalPages);

        for (let index = unassignedPage - 1; index <= unassignedPage + 1; index += 1) {
            if (index >= 1 && index <= unassignedTotalPages) {
                uniquePages.add(index);
            }
        }

        return Array.from(uniquePages).sort((a, b) => a - b);
    }, [unassignedPage, unassignedTotalPages]);

    const unassignedPaginationItems = useMemo(() => {
        const items: (number | "ellipsis")[] = [];
        let previous = 0;

        unassignedPaginationRange.forEach((current) => {
            if (previous && current - previous > 1) {
                items.push("ellipsis");
            }

            items.push(current);
            previous = current;
        });

        return items;
    }, [unassignedPaginationRange]);

    const showUnassignedSkeleton = useMemo(
        () => unassignedLoading && unassignedProcessIds.length === 0,
        [unassignedLoading, unassignedProcessIds],
    );

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleDialogOpenChange = useCallback((open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setAdvogadosPopoverOpen(false);
            setPropostasPopoverOpen(false);
            setAreaPopoverOpen(false);
            setTipoProcessoPopoverOpen(false);
            setSistemaPopoverOpen(false);
            setProcessForm(createEmptyProcessForm());
            setCreateError(null);
            setEditingProcessId(null);
            setEditingProcessGrau(null);
            setLoadingProcessForm(false);
        }
    }, []);

    const handleProcessCreate = async () => {
        if (creatingProcess || loadingProcessForm) {
            return;
        }

        const isEditingProcess = editingProcessId !== null;

        if (!processForm.clienteId) {
            setCreateError("Selecione o cliente responsável pelo processo.");
            return;
        }

        const selectedCliente = clientes.find(
            (cliente) => String(cliente.id) === processForm.clienteId,
        );

        if (!selectedCliente) {
            return;
        }

        setCreateError(null);
        setCreatingProcess(true);

        try {
            const advogadosPayload = processForm.advogados
                .map((id) => Number.parseInt(id, 10))
                .filter((value) => Number.isFinite(value) && value > 0);

            const jurisdicaoPayload = [processForm.municipio, processForm.uf]
                .map((value) => value?.trim())
                .filter((value) => value && value.length > 0)
                .join(" - ");

            const payload: Record<string, unknown> = {
                cliente_id: selectedCliente.id,
                numero: processForm.numero,
                uf: processForm.uf,
                municipio: processForm.municipio,
                ...(jurisdicaoPayload ? { jurisdicao: jurisdicaoPayload } : {}),
                advogados: advogadosPayload,
            };

            if (isEditingProcess) {
                payload.grau =
                    editingProcessGrau && editingProcessGrau.trim().length > 0
                        ? editingProcessGrau
                        : "1º Grau";
            }

            const instanciaPayload =
                processForm.instancia === INSTANCIA_OUTRO_VALUE
                    ? processForm.instanciaOutro.trim()
                    : processForm.instancia.trim();
            if (instanciaPayload) {
                payload.instancia = instanciaPayload;
            }

            const dataDistribuicaoPayload = processForm.dataDistribuicao.trim();
            if (dataDistribuicaoPayload) {
                payload.data_distribuicao = dataDistribuicaoPayload;
            }

            const propostaId = parseOptionalInteger(processForm.propostaId);
            if (propostaId && propostaId > 0) {
                payload.oportunidade_id = propostaId;
            }

            const tipoProcessoId = parseOptionalInteger(processForm.tipoProcessoId);
            if (tipoProcessoId && tipoProcessoId > 0) {
                payload.tipo_processo_id = tipoProcessoId;
            }

            const areaAtuacaoId = parseOptionalInteger(processForm.areaAtuacaoId);
            if (areaAtuacaoId && areaAtuacaoId > 0) {
                payload.area_atuacao_id = areaAtuacaoId;
            }

            const sistemaCnjId = parseOptionalInteger(processForm.sistemaCnjId);
            if (sistemaCnjId && sistemaCnjId > 0) {
                payload.sistema_cnj_id = sistemaCnjId;
            }

            payload.monitorar_processo = processForm.monitorarProcesso;

            const endpoint = isEditingProcess
                ? `processos/${editingProcessId}`
                : "processos";

            const res = await fetch(getApiUrl(endpoint), {
                method: isEditingProcess ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de criação", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" &&
                        "error" in json &&
                        typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : `Não foi possível ${isEditingProcess ? "atualizar" : "cadastrar"} o processo (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error(
                    `Resposta inválida do servidor ao ${isEditingProcess ? "atualizar" : "cadastrar"} o processo`,
                );
            }

            toast({
                title: isEditingProcess
                    ? "Processo atualizado com sucesso"
                    : "Processo cadastrado com sucesso",
            });
            handleDialogOpenChange(false);
            try {
                if (isEditingProcess || page === 1) {
                    const data = await loadProcessos();
                    applyProcessosData(data);
                } else {
                    setPage(1);
                }
            } catch (refreshError) {
                console.error("Erro ao atualizar lista de processos", refreshError);
            }
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error
                    ? error.message
                    : `Erro ao ${isEditingProcess ? "atualizar" : "cadastrar"} processo`;
            setCreateError(message);
            toast({
                title: isEditingProcess
                    ? "Erro ao atualizar processo"
                    : "Erro ao cadastrar processo",
                description: message,
                variant: "destructive",
            });
        } finally {
            setCreatingProcess(false);
        }
    };

    const navigateToProcess = useCallback(
        (
            processoToView: Processo,
            options?: { initialTab?: "resumo" | "historico" | "anexos" },
        ) => {
            const chave = gerarChaveAgrupamentoProcesso(processoToView.numero, processoToView.id);
            const agrupados = processosPorNumero[chave] ?? [];
            const relacionadosMesmoNumero = agrupados
                .filter((item) => item.id !== processoToView.id)
                .map(mapProcessoParaResumoRelacionado);

            const baseState = options?.initialTab ? { initialTab: options.initialTab } : undefined;
            const state =
                relacionadosMesmoNumero.length > 0
                    ? { ...(baseState ?? {}), relacionadosMesmoNumero }
                    : baseState;
            const navigateOptions = state ? { state } : undefined;

            const clienteId = processoToView.cliente?.id ?? null;
            const numeroProcesso =
                typeof processoToView.numero === "string" && processoToView.numero.trim().length > 0
                    ? processoToView.numero.trim()
                    : null;

            if (clienteId && clienteId > 0) {
                if (numeroProcesso) {
                    navigate(
                        `/clientes/${clienteId}/processos/${encodeURIComponent(numeroProcesso)}`,
                        navigateOptions,
                    );
                    return;
                }

                navigate(`/clientes/${clienteId}/processos/${processoToView.id}`, navigateOptions);
                return;
            }

            toast({
                title: "Cliente do processo não identificado",
                description: "Abrindo detalhes do processo diretamente.",
            });
            if (numeroProcesso) {
                navigate(`/processos/${encodeURIComponent(numeroProcesso)}`, navigateOptions);
                return;
            }

            navigate(`/processos/${processoToView.id}`, navigateOptions);
        },
        [navigate, processosPorNumero, toast],
    );

    const handleViewProcessDetails = useCallback(
        (processoToView: Processo) => {
            if (viewProcessTimeoutRef.current !== null) {
                window.clearTimeout(viewProcessTimeoutRef.current);
            }

            setViewingProcessId(processoToView.id);

            if (processoToView.nao_lido) {
                void (async () => {
                    try {
                        const result = await markProcessoAsRead(processoToView.id);
                        applyProcessoReadUpdate(result);
                    } catch (error) {
                        console.error(
                            "Falha ao marcar processo como lido ao visualizar detalhes",
                            error,
                        );
                    }
                })();
            }

            const webhookPayload = {
                ...processoToView,
                idempresa: processoToView.idempresa ?? null,
                grau: processoToView.grau ?? null,
                usuario_oab_numero: loggedUserOabNumero ?? null,
                usuario_oab_uf: loggedUserOabUf ?? null,
            };

            void fetch("https://n8n.quantumtecnologia.com.br/webhook/visualizar_processos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(webhookPayload),
            }).catch(() => undefined);

            setViewingProcessId(null);
            navigateToProcess(processoToView);
        },
        [applyProcessoReadUpdate, loggedUserOabNumero, loggedUserOabUf, navigateToProcess],
    );

    const handleEditProcess = useCallback(
        async (processoToEdit: Processo) => {
            setCreateError(null);
            setLoadingProcessForm(true);

            try {
                const res = await fetch(getApiUrl(`processos/${processoToEdit.id}`), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;

                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta do processo", error);
                }

                if (!res.ok) {
                    const message =
                        json &&
                            typeof json === "object" &&
                            "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar o processo (HTTP ${res.status})`;
                    throw new Error(message);
                }

                if (!json || typeof json !== "object") {
                    throw new Error("Resposta inválida do servidor ao carregar o processo");
                }

                const parsed = mapProcessoDetailToFormState(json as Record<string, unknown>);

                setProcessForm(parsed.form);
                setEditingProcessId(processoToEdit.id);
                setEditingProcessGrau(parsed.grau);
                setAdvogadosPopoverOpen(false);
                setPropostasPopoverOpen(false);
                setAreaPopoverOpen(false);
                setTipoProcessoPopoverOpen(false);
                setSistemaPopoverOpen(false);
                setMunicipioPopoverOpen(false);
                setClientePopoverOpen(false);
                setIsDialogOpen(true);
            } catch (error) {
                console.error(error);
                const message =
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar dados do processo";
                toast({
                    title: "Erro ao carregar processo",
                    description: message,
                    variant: "destructive",
                });
                setEditingProcessId(null);
                setEditingProcessGrau(null);
            } finally {
                setLoadingProcessForm(false);
            }
        },
        [toast],
    );

    const handleSyncAll = useCallback(async () => {
        if (oabMonitors.length === 0) {
            toast({
                title: "Nenhuma OAB monitorada",
                description: "Cadastre uma OAB para sincronizar processos.",
                variant: "destructive",
            });
            return;
        }

        setSyncingAll(true);
        let successCount = 0;
        let failCount = 0;

        // Trigger sync for each monitored OAB
        // Ideally the backend should have a 'sync-all' endpoint, but iterating here works for now.
        // We use the existing upsert endpoint which triggers sync.
        await Promise.allSettled(oabMonitors.map(async (monitor) => {
            try {
                const res = await fetch(getApiUrl("processos/oab-monitoradas"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        uf: monitor.uf,
                        numero: monitor.numero,
                        usuarioId: monitor.usuarioId,
                        diasSemana: monitor.diasSemana, 
                        syncFrom: monitor.syncFrom,
                    }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                successCount++;
            } catch (error) {
                console.error(`Erro ao sincronizar OAB ${monitor.numero}/${monitor.uf}`, error);
                failCount++;
            }
        }));

        if (successCount > 0) {
            toast({
                title: "Atualização solicitada",
                description: `${successCount} OAB(s) enviada(s) para sincronização.${failCount > 0 ? ` ${failCount} falharam.` : ''}`,
            });
             // Reload list to see if anything changed immediately (unlikely for async sync, but good practice)
            try {
                const data = await loadProcessos();
                applyProcessosData(data);
            } catch (e) { console.error(e); }
        } else {
             toast({
                title: "Falha na atualização",
                description: "Não foi possível disparar a sincronização.",
                variant: "destructive",
            });
        }
        setSyncingAll(false);
    }, [oabMonitors, toast, loadProcessos, applyProcessosData]);

    const handleCreateButtonClick = useCallback(() => {
        setEditingProcessId(null);
        setEditingProcessGrau(null);
        setLoadingProcessForm(false);
        setProcessForm(createEmptyProcessForm());
        setCreateError(null);
        setAdvogadosPopoverOpen(false);
        setPropostasPopoverOpen(false);
        setAreaPopoverOpen(false);
        setTipoProcessoPopoverOpen(false);
        setSistemaPopoverOpen(false);
        setMunicipioPopoverOpen(false);
        setClientePopoverOpen(false);
        setIsDialogOpen(true);
    }, []);

    const handleMarkProcessoAsRead = useCallback(
        async (id: number) => {
            setMarkingProcessoId(id);

            try {
                const result = await markProcessoAsRead(id);
                applyProcessoReadUpdate(result);
                toast({
                    title: "Processo atualizado",
                    description: "Ele foi marcado como lido.",
                });
            } catch (error) {
                toast({
                    title: "Não foi possível marcar como lido",
                    description:
                        error instanceof Error
                            ? error.message
                            : "Tente novamente em instantes.",
                    variant: "destructive",
                });
            } finally {
                setMarkingProcessoId(null);
            }
        },
        [applyProcessoReadUpdate, toast],
    );

    const isInstanciaOutroSelected = processForm.instancia === INSTANCIA_OUTRO_VALUE;

    const isCreateDisabled =
        !processForm.numero ||
        !processForm.uf ||
        !processForm.municipio ||
        !processForm.clienteId ||
        (isInstanciaOutroSelected && processForm.instanciaOutro.trim().length === 0) ||
        creatingProcess ||
        loadingProcessForm;

    const filteredProcessos = useMemo(() => {
        const trimmedSearch = searchTerm.trim();
        const normalizedSearch = trimmedSearch ? normalizeSearchableText(trimmedSearch) : "";
        const numericSearch = trimmedSearch.replace(/\D/g, "");

        return processos.filter((processo) => {
            const matchesStatus =
                statusFilter === "todos" || processo.status === statusFilter;
            const matchesTipo = tipoFilter === "todos" || processo.tipo === tipoFilter;
            const matchesNaoLido =
                naoLidoFilter === "todos" ||
                (naoLidoFilter === "nao_lidos" ? processo.nao_lido : !processo.nao_lido);

            if (!matchesStatus || !matchesTipo || !matchesNaoLido) {
                return false;
            }

            if (normalizedSearch.length === 0) {
                return true;
            }

            const searchPool = [
                processo.numero,
                processo.cliente?.nome,
                processo.status,
                processo.tipo,
                processo.orgaoJulgador,
                processo.classeJudicial,
                processo.advogados
                    .map((adv) => [adv.nome, adv.oab].filter(Boolean).join(" "))
                    .join(" "),
                processo.proposta?.label,
                processo.proposta?.solicitante ?? null,
            ];

            const hasTextMatch = searchPool.some((value) => {
                if (!value) return false;
                return normalizeSearchableText(value).includes(normalizedSearch);
            });

            const documento = processo.cliente?.documento ?? "";
            const propostaNumero = processo.proposta?.label
                ? processo.proposta.label.replace(/\D/g, "")
                : "";
            const hasDocumentoMatch =
                numericSearch.length > 0
                    ? [documento.replace(/\D/g, ""), propostaNumero]
                        .filter((value) => value.length > 0)
                        .some((value) => value.includes(numericSearch))
                    : false;

            return hasTextMatch || hasDocumentoMatch;
        });
    }, [processos, searchTerm, statusFilter, tipoFilter, naoLidoFilter]);

    const canMarkAllAsRead = useMemo(
        () => filteredProcessos.some((processo) => processo.nao_lido),
        [filteredProcessos],
    );

    const handleMarkAllProcessosAsRead = useCallback(async () => {
        const pendentes = filteredProcessos.filter((processo) => processo.nao_lido);

        if (pendentes.length === 0) {
            return;
        }

        setBulkMarkingProcessos(true);

        try {
            const resultados = await Promise.allSettled(
                pendentes.map((processo) => markProcessoAsRead(processo.id)),
            );

            const sucedidos = resultados.filter(
                (resultado): resultado is PromiseFulfilledResult<MarkProcessoAsReadResponse> =>
                    resultado.status === "fulfilled",
            );
            const falhas = resultados.filter((resultado) => resultado.status === "rejected");

            if (sucedidos.length > 0) {
                const atualizacoes = new Map(
                    sucedidos.map((resultado) => [resultado.value.id, resultado.value] as const),
                );

                applyProcessoReadUpdates(atualizacoes);

                toast({
                    title: "Processos atualizados",
                    description: `${sucedidos.length} processo${sucedidos.length > 1 ? "s" : ""
                        } foram marcados como lidos.`,
                });
            }

            if (falhas.length > 0) {
                toast({
                    title: "Alguns processos não foram atualizados",
                    description: "Tente novamente para concluir a operação.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Não foi possível marcar os processos como lidos",
                description:
                    error instanceof Error
                        ? error.message
                        : "Tente novamente em instantes.",
                variant: "destructive",
            });
        } finally {
            setBulkMarkingProcessos(false);
        }
    }, [filteredProcessos, applyProcessoReadUpdates, toast]);

    const isEditing = editingProcessId !== null;

    const dialogTitle = isEditing ? "Editar processo" : "Cadastrar processo";

    const dialogDescription = loadingProcessForm
        ? "Carregando dados do processo selecionado..."
        : isEditing
            ? "Atualize os dados do processo selecionado."
            : "Informe os dados básicos para registrar um novo processo.";

    const submitButtonLabel = creatingProcess
        ? isEditing
            ? "Salvando..."
            : "Cadastrando..."
        : isEditing
            ? "Salvar alterações"
            : "Cadastrar";

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between px-1">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Processos
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Monitore os processos em andamento, acompanhe movimentações internas e identifique prioridades com mais clareza.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                     <Button
                        variant="outline"
                        onClick={handleSyncAll}
                        disabled={syncingAll || oabMonitors.length === 0}
                        className="h-10 border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/60 transition-colors"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncingAll ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                    <Button variant="outline" onClick={handleOpenOabModal} className="h-10 border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/60 transition-colors">
                        <GavelIcon className="mr-2 h-4 w-4 text-primary" />
                        Gerenciar OABs
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleMarkAllProcessosAsRead}
                        className="h-10 bg-secondary/50 hover:bg-secondary/80"
                        disabled={processosLoading || bulkMarkingProcessos || !canMarkAllAsRead}
                    >
                        {bulkMarkingProcessos ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        Marcar lidos
                    </Button>
                    <Button onClick={handleCreateButtonClick} className="h-10 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:-translate-y-0.5">
                        <FileText className="mr-2 h-4 w-4" />
                        Cadastrar processo
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Card className="relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md">
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
                    <CardContent className="flex flex-col justify-between gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                                <GavelIcon className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-xs text-primary">
                                Total
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{totalProcessos}</p>
                            <p className="text-xs text-muted-foreground font-medium">Processos cadastrados</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md">
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/5 blur-2xl" />
                    <CardContent className="flex flex-col justify-between gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 transition-colors group-hover:bg-purple-500/20">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400">
                                1ª Instância
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{totalPrimeiraInstancia}</p>
                            <p className="text-xs text-muted-foreground font-medium">Processos em 1º grau</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md">
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl" />
                    <CardContent className="flex flex-col justify-between gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 transition-colors group-hover:bg-indigo-500/20">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400">
                                2ª Instância
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{totalSegundaInstancia}</p>
                            <p className="text-xs text-muted-foreground font-medium">Processos em 2º grau</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md">
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" />
                    <CardContent className="flex flex-col justify-between gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500/20">
                                <Clock className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                Ativos
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{processosEmAndamento}</p>
                            <p className="text-xs text-muted-foreground font-medium">Em andamento</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md">
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-slate-500/5 blur-2xl" />
                    <CardContent className="flex flex-col justify-between gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 transition-colors group-hover:bg-slate-500/20">
                                <Archive className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                Arquivados
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{processosArquivados}</p>
                            <p className="text-xs text-muted-foreground font-medium">Extintos ou arquivados</p>
                        </div>
                    </CardContent>
                </Card>


            </div>



            <Card className="sticky top-4 z-30 border-border/40 bg-background/80 backdrop-blur-md shadow-sm transition-all hover:shadow-md hover:bg-background/90 supports-[backdrop-filter]:bg-background/60">
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className="relative flex-1 group">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 transition-colors group-hover:text-primary" />
                            <Input
                                placeholder="Pesquisar por número, cliente, CPF ou advogado..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="h-11 border-muted-foreground/20 bg-muted/20 pl-10 transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 group-hover:bg-muted/30 group-hover:border-primary/20"
                            />
                        </div>
                        <div className="flex flex-1 flex-col gap-4 sm:flex-row md:flex-none">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-11 w-full bg-muted/20 border-muted-foreground/20 hover:bg-muted/30 hover:border-primary/20 transition-all md:w-[200px]">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Filter className="h-4 w-4" />
                                        <span className="text-foreground"><SelectValue placeholder="Status" /></span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os status</SelectItem>
                                    {statusOptions.length === 0 ? (
                                        <SelectItem value="__empty" disabled>
                                            Nenhum status disponível
                                        </SelectItem>
                                    ) : (
                                        statusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <Select value={tipoFilter} onValueChange={setTipoFilter}>
                                <SelectTrigger className="h-11 w-full bg-muted/20 border-muted-foreground/20 hover:bg-muted/30 hover:border-primary/20 transition-all md:w-[200px]">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        <span className="text-foreground"><SelectValue placeholder="Tipo" /></span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os tipos</SelectItem>
                                    {tipoOptions.length === 0 ? (
                                        <SelectItem value="__empty" disabled>
                                            Nenhum tipo disponível
                                        </SelectItem>
                                    ) : (
                                        tipoOptions.map((tipo) => (
                                            <SelectItem key={tipo} value={tipo}>
                                                {tipo}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <Select value={naoLidoFilter} onValueChange={setNaoLidoFilter}>
                                <SelectTrigger className="h-11 w-full bg-muted/20 border-muted-foreground/20 hover:bg-muted/30 hover:border-primary/20 transition-all md:w-[200px]">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Eye className="h-4 w-4" />
                                        <span className="text-foreground"><SelectValue placeholder="Leitura" /></span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="nao_lidos">Não lidos</SelectItem>
                                    <SelectItem value="lidos">Lidos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {processosLoading ? (
                <div className="space-y-4 py-8">
                    <div className="mx-auto w-full space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-40 w-full animate-pulse rounded-xl border border-border/40 bg-muted/20 p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-3 w-full max-w-lg">
                                        <div className="h-6 w-3/4 rounded-md bg-muted/40" />
                                        <div className="flex gap-2">
                                            <div className="h-5 w-20 rounded-md bg-muted/40" />
                                            <div className="h-5 w-24 rounded-md bg-muted/40" />
                                        </div>
                                    </div>
                                    <div className="h-8 w-24 rounded-md bg-muted/40" />
                                </div>
                                <div className="mt-8 grid grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <div className="h-3 w-16 rounded bg-muted/40" />
                                        <div className="h-4 w-32 rounded bg-muted/40" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-16 rounded bg-muted/40" />
                                        <div className="h-4 w-32 rounded bg-muted/40" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-16 rounded bg-muted/40" />
                                        <div className="h-4 w-32 rounded bg-muted/40" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : processosError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-destructive animate-in fade-in-50">
                    <AlertCircle className="mx-auto h-8 w-8 mb-3 opacity-80" />
                    <p className="font-semibold text-lg">Erro ao carregar processos</p>
                    <p className="text-sm opacity-90 mb-4 max-w-md mx-auto">{processosError}</p>
                    <Button variant="outline" onClick={() => window.location.reload()} className="border-destructive/30 hover:bg-destructive/10 text-destructive hover:text-destructive">
                        Tentar novamente
                    </Button>
                </div>
            ) : filteredProcessos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 bg-muted/5 py-16 text-center animate-in fade-in-50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/10 text-muted-foreground mb-4">
                        <Search className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Nenhum processo encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                        Nenhum registro corresponde aos filtros selecionados.
                    </p>
                    <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setTipoFilter('todos'); setNaoLidoFilter('todos'); }}>
                        Limpar filtros
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProcessos.map((processo) => (
                        <ProcessCard
                            key={processo.id}
                            numero={processo.numero}
                            status="Ativo"//{processo.status}
                            classe={processo.classeJudicial}
                            cliente={processo.cliente.nome}
                            advogadosResumo={processo.advogadosResumo}
                            advogados={
                                processo.advogadoResponsavel
                                    ? processo.advogadoResponsavel
                                    : processo.advogados.length > 0
                                        ? processo.advogados
                                            .map((advogado) =>
                                                advogado.oab
                                                    ? `${advogado.nome} (${advogado.oab})`
                                                    : advogado.nome,
                                            )
                                            .join(", ")
                                        : "Não informado"
                            }
                            dataDistribuicao={processo.dataDistribuicao}
                            ultimaMovimentacao={processo.ultimaMovimentacao}
                            ultimaMovimentacaoData={processo.ultimaMovimentacaoData}
                            ultimaMovimentacaoTipo={processo.ultimaMovimentacaoTipo}
                            ultimaMovimentacaoDescricao={processo.ultimaMovimentacaoDescricao}
                            jurisdicao={processo.jurisdicao}
                            orgaoJulgador={processo.orgaoJulgador}
                            onView={() => handleViewProcessDetails(processo)}
                            onEdit={() => handleEditProcess(processo)}
                            isLoading={viewingProcessId === processo.id}
                            naoLido={processo.nao_lido}
                            onMarkAsRead={
                                processo.nao_lido ? () => handleMarkProcessoAsRead(processo.id) : undefined
                            }
                            isMarkingAsRead={markingProcessoId === processo.id}
                        />
                    ))}

                    <div className="flex flex-col gap-4 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground whitespace-nowrap">
                            Mostrando {pageStart}–{pageEnd} de {totalProcessos} processos
                        </p>
                        
                        {!searchTerm && (
                            <div className="flex items-center space-x-6 sm:space-x-8">
                                <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium">Linhas por página</p>
                                    <Select
                                        value={`${pageSize}`}
                                        onValueChange={(value) => {
                                            setPageSize(Number(value));
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-[70px]">
                                            <SelectValue placeholder={pageSize} />
                                        </SelectTrigger>
                                        <SelectContent side="top">
                                            {[10, 20, 50, 100].map((size) => (
                                                <SelectItem key={size} value={`${size}`}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                                    Página {page} de {Math.ceil(totalProcessos / pageSize) || 1}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        className="hidden h-8 w-8 p-0 lg:flex"
                                        onClick={() => setPage(1)}
                                        disabled={page === 1}
                                    >
                                        <span className="sr-only">Ir para a primeira página</span>
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setPage((current) => Math.max(current - 1, 1))}
                                        disabled={page === 1}
                                    >
                                        <span className="sr-only">Ir para a página anterior</span>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setPage((current) => Math.min(current + 1, Math.ceil(totalProcessos / pageSize) || 1))}
                                        disabled={page === (Math.ceil(totalProcessos / pageSize) || 1)}
                                    >
                                        <span className="sr-only">Ir para a próxima página</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="hidden h-8 w-8 p-0 lg:flex"
                                        onClick={() => setPage(Math.ceil(totalProcessos / pageSize) || 1)}
                                        disabled={page === (Math.ceil(totalProcessos / pageSize) || 1)}
                                    >
                                        <span className="sr-only">Ir para a última página</span>
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Dialog open={oabSyncingProcesses}>
                <DialogContent className="sm:max-w-sm">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm font-medium text-foreground">
                            Sincronizando processos
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Aguarde enquanto sincronizamos os processos vinculados ao registro.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isOabModalOpen} onOpenChange={handleOabModalChange}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <DialogHeader className="border-b border-border/40 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-8 ring-primary/5">
                                <GavelIcon className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-xl">Gerenciar OABs Monitoradas</DialogTitle>
                                <DialogDescription className="text-base">
                                    Acompanhe automaticamente as publicações e andamentos de OABs vinculadas.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex flex-col gap-6 py-6">
                        {/* Section: Active Monitors */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                    Monitoramentos ativos
                                </h3>
                                {oabMonitors.length > 0 && (
                                    <Badge variant="secondary" className="rounded-full px-2.5">
                                        {oabMonitors.length}
                                    </Badge>
                                )}
                            </div>

                            {oabMonitorsLoading ? (
                                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Carregando monitoramentos...
                                </div>
                            ) : oabMonitorsError ? (
                                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                                    {oabMonitorsError}
                                </div>
                            ) : oabMonitors.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center">
                                    <p className="text-sm text-primary/80 font-medium">
                                        Nenhuma OAB sendo monitorada no momento.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {oabMonitors.map((monitor) => (
                                        <div
                                            key={monitor.id}
                                            className="group relative flex flex-col justify-between gap-4 rounded-xl border border-border/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/20 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className="font-mono text-xs font-semibold border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
                                                        {formatOabDisplay(monitor.numero, monitor.uf)}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveOabMonitor(monitor.id)}
                                                        disabled={oabRemovingId === monitor.id}
                                                    >
                                                        {oabRemovingId === monitor.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 size={16} />
                                                        )}
                                                        <span className="sr-only">Remover</span>
                                                    </Button>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-medium leading-none text-foreground truncate">
                                                        {monitor.usuarioNome ?? "Usuário não identificado"}
                                                    </p>
                                                    {monitor.usuarioOab ? (
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {monitor.usuarioOab}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-[10px]">
                                                    <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                                        <Calendar className="h-3 w-3" />
                                                        Desde {formatSyncFromValue(monitor.syncFrom)}
                                                    </span>
                                                    <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDiasSemanaDescription(monitor.diasSemana)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-border/50" />

                        {/* Section: New Monitor */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                    Cadastrar nova OAB
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Selecione o advogado responsável para iniciar o monitoramento.
                                </p>
                            </div>

                            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 space-y-5 dark:border-blue-900/20 dark:bg-blue-950/10">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        Responsável
                                    </Label>
                                    <Select
                                        value={oabUsuarioId}
                                        onValueChange={handleOabUsuarioChange}
                                        disabled={oabUsuariosLoading || oabUsuarioOptions.length === 0}
                                    >
                                        <SelectTrigger className="h-10 bg-background border-blue-200/50 dark:border-blue-900/50 focus:ring-blue-500/20">
                                            <SelectValue
                                                placeholder={
                                                    oabUsuariosLoading
                                                        ? "Carregando usuários..."
                                                        : oabUsuariosError ?? "Selecione o responsável"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {oabUsuarioOptions.map((option) => (
                                                <SelectItem key={option.id} value={option.id}>
                                                    {option.oab ? `${option.nome} (${option.oab})` : option.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {oabUsuariosError ? (
                                        <p className="text-sm text-destructive">{oabUsuariosError}</p>
                                    ) : null}
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                            Sincronização Automática
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Escolha os dias da semana para verificar novas publicações.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {BUSINESS_DAY_VALUES.map((day) => {
                                            const label = DIA_SEMANA_LABELS[day];
                                            const checked = oabDiasSemana.includes(day);
                                            return (
                                                <div
                                                    key={day}
                                                    onClick={() => {
                                                        setOabDiasSemana((prev) => {
                                                            const nextSet = new Set(prev);
                                                            if (checked) {
                                                                nextSet.delete(day);
                                                            } else {
                                                                nextSet.add(day);
                                                            }
                                                            return Array.from(nextSet).sort((a, b) => a - b);
                                                        });
                                                        setOabSubmitError(null);
                                                    }}
                                                    className={`
                                                        cursor-pointer select-none rounded-md px-3 py-1.5 text-xs font-medium transition-all border
                                                        ${checked
                                                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                                                        }
                                                    `}
                                                >
                                                    {label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                            Histórico
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Defina a data de início da busca.
                                        </p>
                                    </div>
                                    <RadioGroup
                                        value={oabSyncFromMode}
                                        onValueChange={(next) => handleOabSyncFromModeChange(next as "all" | "date")}
                                        className="grid gap-4 sm:grid-cols-2"
                                    >
                                        <div className={`
                                            flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer
                                            ${oabSyncFromMode === "all"
                                                ? "bg-blue-50/80 border-blue-200 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:border-blue-800 dark:ring-blue-700"
                                                : "bg-background border-border hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                                            }
                                        `}>
                                            <RadioGroupItem value="all" id="oab-sync-from-all" />
                                            <Label htmlFor="oab-sync-from-all" className="flex-1 cursor-pointer font-normal text-sm">
                                                Tudo (Todo histórico)
                                            </Label>
                                        </div>

                                        <div className={`
                                            flex flex-col gap-2 rounded-lg border p-3 transition-colors
                                            ${oabSyncFromMode === "date"
                                                ? "bg-blue-50/80 border-blue-200 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:border-blue-800 dark:ring-blue-700"
                                                : "bg-background border-border hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                                            }
                                        `}>
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="date" id="oab-sync-from-date" />
                                                <Label htmlFor="oab-sync-from-date" className="flex-1 cursor-pointer font-normal text-sm">
                                                    A partir de uma data
                                                </Label>
                                            </div>

                                            {oabSyncFromMode === "date" && (
                                                <Popover
                                                    open={oabSyncFromCalendarOpen}
                                                    onOpenChange={setOabSyncFromCalendarOpen}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className={`w-full justify-start text-left font-normal h-8 mt-1 border-dashed
                                                                ${!oabSyncFromDate ? "text-muted-foreground" : "text-primary border-primary/30 bg-primary/5"}
                                                            `}
                                                        >
                                                            <Calendar className="mr-2 h-3 w-3" />
                                                            {formatSyncFromDateLabel(oabSyncFromDate) || "Selecione a data"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-auto p-0">
                                                        <CalendarPicker
                                                            mode="single"
                                                            selected={oabSyncFromDate ?? undefined}
                                                            onSelect={handleOabSyncFromDateSelect}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>

                            {oabSubmitError ? (
                                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        {oabSubmitError}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 border-t border-border/40 pt-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleOabModalChange(false)}
                            disabled={oabSubmitLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleOabSubmit}
                            disabled={
                                oabSubmitLoading ||
                                !oabUf ||
                                !oabNumero ||
                                !oabUsuarioId ||
                                oabUsuariosLoading
                            }
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {oabSubmitLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cadastrando...
                                </>
                            ) : (
                                "Cadastrar OAB"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={unassignedModalOpen} onOpenChange={handleUnassignedModalChange}>
                <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <DialogHeader className="space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <UsersIcon className="h-5 w-5" />
                                </span>
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl font-semibold text-foreground">
                                        Processos sincronizados sem cliente vinculado
                                    </DialogTitle>
                                    <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                                        Vincule clientes, propostas e relações com os envolvidos para completar o cadastro.
                                    </DialogDescription>
                                </div>
                            </div>
                            {unassignedTotal ? (
                                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                                    {unassignedTotal} processo{unassignedTotal > 1 ? "s" : ""} pendente{unassignedTotal > 1 ? "s" : ""}
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                                    Tudo em dia
                                </Badge>
                            )}
                        </div>
                        <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                            Organize os cadastros pendentes escolhendo o cliente correto e conectando as propostas relacionadas.
                        </div>
                    </DialogHeader>
                    {unassignedError ? (
                        <p className="text-sm text-destructive">{unassignedError}</p>
                    ) : null}
                    {showUnassignedSkeleton ? (
                        <div className="space-y-2">
                            {[0, 1].map((item) => (
                                <Skeleton key={item} className="h-24 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : unassignedProcessIds.length === 0 && !unassignedError ? (
                        <p className="text-sm text-muted-foreground">
                            Todos os processos já possuem clientes vinculados.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {unassignedTotal > 0 ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Mostrando {unassignedPageStart}–{unassignedPageEnd} de {unassignedTotal}{" "}
                                        processos clientes vinculados
                                    </p>
                                </div>
                            ) : null}
                            {unassignedProcessIds.map((processId) => {
                                const detail = unassignedDetails[processId];
                                const baseProcess = unassignedProcesses.find(
                                    (processo) => processo.id === processId,
                                );

                                if (!detail || !baseProcess) {
                                    return (
                                        <Card key={processId} className="border-border/60 bg-muted/30">
                                            <CardHeader>
                                                <CardTitle>Carregando processo...</CardTitle>
                                                <CardDescription>Aguarde enquanto buscamos os detalhes.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <Skeleton className="h-20 w-full" />
                                            </CardContent>
                                        </Card>
                                    );
                                }

                                const hasExistingClient = Boolean(detail.selectedExistingClientId);
                                const selectedExistingClient = hasExistingClient
                                    ? clientes.find(
                                        (cliente) =>
                                            String(cliente.id) === detail.selectedExistingClientId,
                                    ) ?? null
                                    : null;
                                const isClientPopoverOpen =
                                    unassignedClientPopoverOpenId === processId;
                                const clientButtonLabel = (() => {
                                    if (clientesLoading && clientes.length === 0) {
                                        return "Carregando clientes...";
                                    }

                                    if (selectedExistingClient) {
                                        return `${selectedExistingClient.nome}${selectedExistingClient.documento
                                            ? ` — ${selectedExistingClient.documento}`
                                            : ""
                                            }`;
                                    }

                                    if (hasExistingClient) {
                                        return `Cliente #${detail.selectedExistingClientId}`;
                                    }

                                    return "Cliente não cadastrado";
                                })();
                                const availablePropostas = hasExistingClient
                                    ? propostas.filter(
                                        (proposta) => proposta.solicitanteId === detail.selectedExistingClientId,
                                    )
                                    : [];
                                const canSave =
                                    hasExistingClient || Boolean(detail.primaryParticipantId);
                                const municipioOptions = detail.form.uf
                                    ? unassignedMunicipiosByUf[detail.form.uf] ?? []
                                    : [];
                                const municipioLoading = detail.form.uf
                                    ? unassignedMunicipiosLoadingUf === detail.form.uf
                                    : false;
                                const municipioError = detail.form.uf
                                    ? unassignedMunicipiosErrorByUf[detail.form.uf]
                                    : undefined;
                                const isMunicipioPopoverOpen =
                                    unassignedMunicipioPopoverOpenId === processId;
                                const municipioButtonLabel = (() => {
                                    if (!detail.form.uf) {
                                        return "Selecione a UF";
                                    }

                                    if (municipioLoading) {
                                        return "Carregando municípios...";
                                    }

                                    if (detail.form.municipio) {
                                        return detail.form.municipio;
                                    }

                                    return municipioOptions.length === 0
                                        ? "Selecione o município (opcional)"
                                        : "Selecione o município";
                                })();

                                return (
                                    <Card
                                        key={processId}
                                        className="rounded-2xl border border-border/50 bg-card/80 shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl"
                                    >
                                        <CardHeader>
                                            <CardTitle>Processo {baseProcess.numero}</CardTitle>
                                            <CardDescription>
                                                Indique quem é o cliente do escritório e vincule propostas relacionadas.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Meus Clientes</Label>
                                                    <Popover
                                                        open={isClientPopoverOpen}
                                                        onOpenChange={(open) =>
                                                            setUnassignedClientPopoverOpenId(
                                                                open ? processId : null,
                                                            )
                                                        }
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={isClientPopoverOpen}
                                                                className="w-full justify-between"
                                                            >
                                                                <span className="truncate">{clientButtonLabel}</span>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Buscar cliente..." />
                                                                <CommandList>
                                                                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        <CommandItem
                                                                            value="Cliente não cadastrado"
                                                                            onSelect={() => {
                                                                                handleExistingClientSelection(
                                                                                    processId,
                                                                                    NO_EXISTING_CLIENT_SELECT_VALUE,
                                                                                );
                                                                                setUnassignedClientPopoverOpenId(null);
                                                                            }}
                                                                        >
                                                                            <span>Cliente não cadastrado</span>
                                                                            <Check
                                                                                className={`ml-auto h-4 w-4 ${hasExistingClient
                                                                                    ? "opacity-0"
                                                                                    : "opacity-100"
                                                                                    }`}
                                                                            />
                                                                        </CommandItem>
                                                                        {clientes.map((cliente) => {
                                                                            const optionLabel = `${cliente.nome}${cliente.documento
                                                                                ? ` — ${cliente.documento}`
                                                                                : ""
                                                                                }`;
                                                                            const isSelected =
                                                                                detail.selectedExistingClientId ===
                                                                                String(cliente.id);
                                                                            const searchableText = [
                                                                                cliente.nome,
                                                                                cliente.documento,
                                                                                cliente.tipo,
                                                                                String(cliente.id),
                                                                            ]
                                                                                .filter(Boolean)
                                                                                .join(" ");
                                                                            return (
                                                                                <CommandItem
                                                                                    key={cliente.id}
                                                                                    value={searchableText}
                                                                                    onSelect={() => {
                                                                                        handleExistingClientSelection(
                                                                                            processId,
                                                                                            String(cliente.id),
                                                                                        );
                                                                                        setUnassignedClientPopoverOpenId(null);
                                                                                    }}
                                                                                >
                                                                                    <span>{optionLabel}</span>
                                                                                    <Check
                                                                                        className={`ml-auto h-4 w-4 ${isSelected
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                            }`}
                                                                                    />
                                                                                </CommandItem>
                                                                            );
                                                                        })}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {!hasExistingClient ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            Se preferir, marque um envolvido abaixo para criar o
                                                            pré-cadastro automaticamente.
                                                        </p>
                                                    ) : null}
                                                </div>
                                                {hasExistingClient ? (
                                                    <div className="space-y-2">
                                                        <Label>Proposta relacionada</Label>
                                                        <Select
                                                            value={
                                                                detail.selectedPropostaId ||
                                                                NO_PROPOSTA_SELECT_VALUE
                                                            }
                                                            onValueChange={(value) =>
                                                                handleSelectedPropostaChange(processId, value)
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Sem proposta vinculada" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value={NO_PROPOSTA_SELECT_VALUE}>
                                                                    Sem proposta
                                                                </SelectItem>
                                                                {availablePropostas.map((proposta) => (
                                                                    <SelectItem key={proposta.id} value={proposta.id}>
                                                                        {proposta.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ) : null}
                                                <div className="space-y-2">
                                                    <Label htmlFor={`unassigned-uf-${processId}`}>UF</Label>
                                                    <Select
                                                        value={detail.form.uf}
                                                        onValueChange={(value) =>
                                                            handleUnassignedUfChange(processId, value)
                                                        }
                                                    >
                                                        <SelectTrigger id={`unassigned-uf-${processId}`}>
                                                            <SelectValue placeholder="Selecione a UF" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {ufOptions.map((uf) => (
                                                                <SelectItem key={uf.sigla} value={uf.sigla}>
                                                                    {uf.nome} ({uf.sigla})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`unassigned-municipio-${processId}`}>
                                                        Município
                                                    </Label>
                                                    <Popover
                                                        open={isMunicipioPopoverOpen}
                                                        onOpenChange={(open) =>
                                                            handleUnassignedMunicipioPopoverChange(
                                                                processId,
                                                                open,
                                                                detail.form.uf,
                                                            )
                                                        }
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                id={`unassigned-municipio-${processId}`}
                                                                type="button"
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={isMunicipioPopoverOpen}
                                                                className="w-full justify-between"
                                                                disabled={!detail.form.uf || municipioLoading}
                                                            >
                                                                <span className="truncate">{municipioButtonLabel}</span>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent
                                                            className="w-[var(--radix-popover-trigger-width)] p-0"
                                                            align="start"
                                                        >
                                                            <Command>
                                                                <CommandInput placeholder="Pesquisar município..." />
                                                                <CommandList>
                                                                    <CommandEmpty>
                                                                        {!detail.form.uf
                                                                            ? "Selecione a UF primeiro"
                                                                            : municipioLoading
                                                                                ? "Carregando municípios..."
                                                                                : municipioError ??
                                                                                "Nenhum município encontrado"}
                                                                    </CommandEmpty>
                                                                    <CommandGroup>
                                                                        <CommandItem
                                                                            value=""
                                                                            onSelect={() =>
                                                                                handleUnassignedMunicipioSelect(
                                                                                    processId,
                                                                                    "",
                                                                                )
                                                                            }
                                                                        >
                                                                            <Check
                                                                                className={`mr-2 h-4 w-4 ${detail.form.municipio
                                                                                    ? "opacity-0"
                                                                                    : "opacity-100"
                                                                                    }`}
                                                                            />
                                                                            Nenhum município selecionado
                                                                        </CommandItem>
                                                                        {municipioOptions.map((municipio) => {
                                                                            const selected =
                                                                                detail.form.municipio ===
                                                                                municipio.nome;
                                                                            return (
                                                                                <CommandItem
                                                                                    key={municipio.id}
                                                                                    value={municipio.nome}
                                                                                    onSelect={() =>
                                                                                        handleUnassignedMunicipioSelect(
                                                                                            processId,
                                                                                            municipio.nome,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Check
                                                                                        className={`mr-2 h-4 w-4 ${selected
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                            }`}
                                                                                    />
                                                                                    {municipio.nome}
                                                                                </CommandItem>
                                                                            );
                                                                        })}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {municipioError ? (
                                                        <p className="text-xs text-destructive">{municipioError}</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            {!hasExistingClient ? (
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Envolvidos do processo</Label>
                                                    {detail.participants.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">
                                                            Nenhum envolvido identificado para este processo.
                                                        </p>
                                                    ) : (
                                                        <RadioGroup
                                                            value={detail.primaryParticipantId ?? ""}
                                                            onValueChange={(value) =>
                                                                handlePrimaryParticipantChange(processId, value)
                                                            }
                                                            className="space-y-3"
                                                        >
                                                            {detail.participants.map((participant) => {
                                                                const checked = detail.selectedParticipantIds.includes(
                                                                    participant.id,
                                                                );
                                                                const primaryParticipantId = `primary-${processId}-${participant.id}`;
                                                                const involvedParticipantId = `involved-${processId}-${participant.id}`;
                                                                return (
                                                                    <div
                                                                        key={participant.id}
                                                                        className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3"
                                                                    >
                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                            <div className="space-y-1">
                                                                                <p className="text-sm font-medium text-foreground">
                                                                                    {participant.name}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {participant.document
                                                                                        ? `Documento: ${participant.document}`
                                                                                        : "Documento não informado"}
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {participant.role ? (
                                                                                        <Badge variant="secondary">
                                                                                            {participant.role}
                                                                                        </Badge>
                                                                                    ) : null}
                                                                                    {participant.type ? (
                                                                                        <Badge variant="outline">
                                                                                            {participant.type}
                                                                                        </Badge>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col items-end gap-2">
                                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                                    <RadioGroupItem
                                                                                        value={participant.id}
                                                                                        id={primaryParticipantId}
                                                                                    />
                                                                                    <Label
                                                                                        htmlFor={primaryParticipantId}
                                                                                        className="text-xs font-normal"
                                                                                    >
                                                                                        Cliente principal
                                                                                    </Label>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">

                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </RadioGroup>
                                                    )}
                                                </div>
                                            ) : null}
                                            {detail.error ? (
                                                <p className="text-sm text-destructive">{detail.error}</p>
                                            ) : null}
                                            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                                <Button
                                                    onClick={() => void handleLinkProcess(processId)}
                                                    disabled={!canSave || detail.saving}
                                                >
                                                    {detail.saving ? "Vinculando..." : "Salvar vinculação"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            {unassignedTotalPages > 1 ? (
                                <Pagination className="justify-center">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationLink
                                                href="#"
                                                size="default"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setUnassignedPage((current) => Math.max(current - 1, 1));
                                                }}
                                                aria-disabled={unassignedPage === 1}
                                                className={
                                                    unassignedPage === 1
                                                        ? "pointer-events-none opacity-50"
                                                        : undefined
                                                }
                                            >
                                                <ChevronLeft className="mr-1 h-4 w-4" />
                                                <span>Anterior</span>
                                            </PaginationLink>
                                        </PaginationItem>
                                        {unassignedPaginationItems.map((item, itemIndex) =>
                                            typeof item === "number" ? (
                                                <PaginationItem key={item}>
                                                    <PaginationLink
                                                        href="#"
                                                        isActive={item === unassignedPage}
                                                        size="default"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            setUnassignedPage(item);
                                                        }}
                                                    >
                                                        {item}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={`ellipsis-${itemIndex}`}>
                                                    <PaginationEllipsis />
                                                </PaginationItem>
                                            ),
                                        )}
                                        <PaginationItem>
                                            <PaginationLink
                                                href="#"
                                                size="default"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setUnassignedPage((current) =>
                                                        Math.min(current + 1, unassignedTotalPages),
                                                    );
                                                }}
                                                aria-disabled={unassignedPage === unassignedTotalPages}
                                                className={
                                                    unassignedPage === unassignedTotalPages
                                                        ? "pointer-events-none opacity-50"
                                                        : undefined
                                                }
                                            >
                                                <span>Próxima</span>
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            ) : null}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleUnassignedModalChange(false)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">

                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-client">Cliente</Label>
                            <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-client"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={clientePopoverOpen}
                                        className="w-full justify-between"
                                        disabled={clientesLoading && clientes.length === 0}
                                    >
                                        <span className="truncate">{clienteButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar cliente..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {clientesLoading
                                                    ? "Carregando clientes..."
                                                    : "Nenhum cliente encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {clientes.map((cliente) => (
                                                    <CommandItem
                                                        key={cliente.id}
                                                        value={`${cliente.nome} ${cliente.documento ?? ""}`.trim()}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                clienteId: String(cliente.id),
                                                            }));
                                                            setClientePopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.clienteId === String(cliente.id)
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                                }`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{cliente.nome}</span>
                                                            {cliente.documento ? (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {cliente.documento}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-proposta">Proposta vinculada</Label>
                            <Popover
                                open={propostasPopoverOpen}
                                onOpenChange={setPropostasPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-proposta"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={propostasPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={propostasLoading && propostas.length === 0}
                                    >
                                        <span className="truncate">{propostaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Buscar proposta..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {propostasLoading
                                                    ? "Carregando propostas..."
                                                    : propostasError ?? "Nenhuma proposta encontrada"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="Nenhuma proposta"
                                                    onSelect={() => {
                                                        setProcessForm((prev) => ({ ...prev, propostaId: "" }));
                                                        setPropostasPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${processForm.propostaId === "" ? "opacity-100" : "opacity-0"}`}
                                                    />
                                                    Nenhuma proposta vinculada
                                                </CommandItem>
                                                {filteredPropostas.map((proposta) => {
                                                    const selected = processForm.propostaId === proposta.id;
                                                    return (
                                                        <CommandItem
                                                            key={proposta.id}
                                                            value={proposta.label}
                                                            onSelect={() => {
                                                                setProcessForm((prev) => ({
                                                                    ...prev,
                                                                    propostaId: proposta.id,
                                                                }));
                                                                setPropostasPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{proposta.label}</span>
                                                                {proposta.solicitante ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Solicitante: {proposta.solicitante}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {propostasError ? (
                                <p className="text-xs text-destructive">{propostasError}</p>
                            ) : selectedProposta ? (
                                <p className="text-xs text-muted-foreground">
                                    Proposta selecionada{selectedProposta.solicitante ? ` para ${selectedProposta.solicitante}` : ""}.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Vincule uma proposta existente ao processo (opcional).
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="process-uf">UF</Label>
                            <Select
                                value={processForm.uf}
                                onValueChange={(value) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        uf: value,
                                        municipio: "",
                                    }))
                                }
                            >
                                <SelectTrigger id="process-uf">
                                    <SelectValue placeholder="Selecione a UF" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ufOptions.map((uf) => (
                                        <SelectItem key={uf.sigla} value={uf.sigla}>
                                            {uf.nome} ({uf.sigla})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="process-municipio">Município</Label>
                            <Popover
                                open={municipioPopoverOpen}
                                onOpenChange={setMunicipioPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-municipio"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={municipioPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={!processForm.uf || municipiosLoading}
                                    >
                                        <span className="truncate">{municipioButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar município..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {municipiosLoading
                                                    ? "Carregando municípios..."
                                                    : "Nenhum município encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {municipios.map((municipio) => {
                                                    const selected = processForm.municipio === municipio.nome;
                                                    return (
                                                        <CommandItem
                                                            key={municipio.id}
                                                            value={municipio.nome}
                                                            onSelect={() => {
                                                                setProcessForm((prev) => ({
                                                                    ...prev,
                                                                    municipio: municipio.nome,
                                                                }));
                                                                setMunicipioPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            {municipio.nome}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Advogados responsáveis</Label>
                            <Popover
                                open={advogadosPopoverOpen}
                                onOpenChange={setAdvogadosPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={advogadosPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={advogadosLoading && advogadosOptions.length === 0}
                                    >
                                        <span className="truncate">
                                            {advogadosLoading && advogadosOptions.length === 0
                                                ? "Carregando advogados..."
                                                : selectedAdvogados.length === 0
                                                    ? advogadosOptions.length === 0
                                                        ? "Nenhum advogado disponível"
                                                        : "Selecione os advogados responsáveis"
                                                    : selectedAdvogados.length === 1
                                                        ? selectedAdvogados[0].nome
                                                        : `${selectedAdvogados.length} advogados selecionados`}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar advogados..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {advogadosLoading
                                                    ? "Carregando advogados..."
                                                    : advogadosError ?? "Nenhum advogado encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {advogadosOptions.map((advogado) => {
                                                    const selected = processForm.advogados.includes(advogado.id);
                                                    return (
                                                        <CommandItem
                                                            key={advogado.id}
                                                            value={`${advogado.nome} ${advogado.descricao ?? ""}`}
                                                            onSelect={() => toggleAdvogadoSelection(advogado.id)}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{advogado.nome}</span>
                                                                {advogado.descricao ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {advogado.descricao}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {selectedAdvogados.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedAdvogados.map((advogado) => (
                                        <Badge
                                            key={`selected-${advogado.id}`}
                                            variant="secondary"
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <span>{advogado.nome}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleAdvogadoSelection(advogado.id)}
                                                className="ml-1 text-muted-foreground transition hover:text-foreground"
                                                aria-label={`Remover ${advogado.nome}`}
                                            >
                                                ×
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {advogadosError
                                        ? advogadosError
                                        : ""}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-area-atuacao">Área de atuação</Label>
                            <Popover open={areaPopoverOpen} onOpenChange={setAreaPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={areaPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-area-atuacao"
                                        disabled={areaLoading && areaOptions.length === 0}
                                    >
                                        <span className="truncate">{areaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar área..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {areaLoading
                                                    ? "Carregando áreas..."
                                                    : areaError ?? "Nenhuma área encontrada"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {areaOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                areaAtuacaoId:
                                                                    prev.areaAtuacaoId === option.id ? "" : option.id,
                                                            }));
                                                            setAreaPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.areaAtuacaoId === option.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {areaError ? (
                                <p className="text-xs text-destructive">{areaError}</p>
                            ) : null}

                        </div>

                        <div className="space-y-2 sm:col-span-1">

                            <Label htmlFor="process-tipo-processo">Tipo de processo</Label>
                            <Popover
                                open={tipoProcessoPopoverOpen}
                                onOpenChange={setTipoProcessoPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={tipoProcessoPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-tipo-processo"
                                        disabled={tipoProcessoLoading && tipoProcessoOptions.length === 0}
                                    >
                                        <span className="truncate">{tipoProcessoButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar tipo..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {tipoProcessoLoading
                                                    ? "Carregando tipos..."
                                                    : tipoProcessoError ?? "Nenhum tipo encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {tipoProcessoOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                tipoProcessoId:
                                                                    prev.tipoProcessoId === option.id ? "" : option.id,
                                                            }));
                                                            setTipoProcessoPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.tipoProcessoId === option.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {tipoProcessoError ? (
                                <p className="text-xs text-destructive">{tipoProcessoError}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-number">Número do processo</Label>
                            <Input
                                id="process-number"
                                placeholder="0000000-00.0000.0.00.0000"
                                value={processForm.numero}
                                onChange={(event) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        numero: formatProcessNumber(event.target.value),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-instancia">Instância do processo</Label>
                            <Select
                                value={processForm.instancia}
                                onValueChange={(value) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        instancia: value,
                                        instanciaOutro:
                                            value === INSTANCIA_OUTRO_VALUE ? prev.instanciaOutro : "",
                                    }))
                                }
                            >
                                <SelectTrigger id="process-instancia">
                                    <SelectValue placeholder="Selecione a instância" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INSTANCIA_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-1">

                            <Label htmlFor="process-distribution-date">Data da distribuição</Label>
                            <Input
                                id="process-distribution-date"
                                type="date"
                                value={processForm.dataDistribuicao}
                                onChange={(event) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        dataDistribuicao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        {isInstanciaOutroSelected ? (
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="process-instancia-outro">Especificar instância</Label>
                                <Input
                                    id="process-instancia-outro"
                                    placeholder="Descreva a instância"
                                    value={processForm.instanciaOutro}
                                    onChange={(event) =>
                                        setProcessForm((prev) => ({
                                            ...prev,
                                            instanciaOutro: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        ) : null}
                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-sistema-cnj">Sistema judicial</Label>
                            <Popover open={sistemaPopoverOpen} onOpenChange={setSistemaPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={sistemaPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-sistema-cnj"
                                        disabled={sistemaLoading && sistemaOptions.length === 0}
                                    >
                                        <span className="truncate">{sistemaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar sistema..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {sistemaLoading
                                                    ? "Carregando sistemas..."
                                                    : sistemaError ?? "Nenhum sistema encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {sistemaOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                sistemaCnjId:
                                                                    prev.sistemaCnjId === option.id ? "" : option.id,
                                                            }));
                                                            setSistemaPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.sistemaCnjId === option.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {sistemaError ? (
                                <p className="text-xs text-destructive">{sistemaError}</p>
                            ) : null}
                        </div>

                        <div className="sm:col-span-2">
                            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                                <div className="space-y-1">
                                    <Label htmlFor="process-monitorar" className="text-sm font-medium">
                                        Monitorar processo
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Ative para acompanhar automaticamente atualizações deste processo.
                                    </p>
                                </div>
                                <Switch
                                    id="process-monitorar"
                                    checked={processForm.monitorarProcesso}
                                    onCheckedChange={(checked) =>
                                        setProcessForm((prev) => ({
                                            ...prev,
                                            monitorarProcesso: checked,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    {createError ? (
                        <p className="text-sm text-destructive">{createError}</p>
                    ) : null}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleProcessCreate}
                            disabled={isCreateDisabled}
                        >
                            {submitButtonLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

