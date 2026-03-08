import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  archiveIntimacao,
  fetchIntimacoes,
  markIntimacaoAsRead,
  markAllIntimacoesAsRead,
  syncIntimacoes,
  type Intimacao,
  type MarkIntimacaoAsReadResponse,
} from "@/services/intimacoes";
import { fetchIntegrationApiKeys, generateAiText } from "@/lib/integrationApiKeys";
import { usePlan } from "@/features/plans/PlanProvider";
import { getApiUrl } from "@/lib/api";
import { formatProcessNumber } from "@/lib/utils";
import { normalizarTexto } from "./utils/processo-ui";
import {
  Archive,
  Bell,
  Calendar,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  IdCard,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Users,
  Zap,
  Clock,
  AlertTriangle,
  Building2,
  Scale,
  User,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IntimacaoCard } from "@/components/ui/intimacao-card";

type NormalizedDestinatario = {
  nome: string;
  polo?: string | null;
};

type NormalizedAdvogado = {
  nome: string;
  numeroOab?: string | null;
  ufOab?: string | null;
};


type PeriodFilter = "all" | "7d" | "30d" | "90d" | "month";
type SituationFilter = "ativas" | "todas" | "arquivadas" | "nao-lidas";

type FiltersState = {
  search: string;
  advogado: string;
  periodo: PeriodFilter;
  situacao: SituationFilter;
  tribunal: string;
  tipo: string;
};

const ITEMS_PER_PAGE = 15;
const numberFormatter = new Intl.NumberFormat("pt-BR");

type MonitoredOab = {
  id: string;
  uf: string;
  number: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  usuarioOabNumero: string | null;
  usuarioOabUf: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  diasSemana: number[] | null;
  syncFrom: string | null;
};

type CompanyUserOption = {
  id: string;
  name: string;
  oabNumber: string | null;
  oabUf: string | null;
};

const normalizeAdvogadoName = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

const normalizeAdvogadoOabNumber = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  return digits ? digits : null;
};

const normalizeAdvogadoUf = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return normalized.length === 2 ? normalized : null;
};

type ApiCompanyUser = {
  id?: number | string | null;
  id_usuario?: number | string | null;
  idUsuario?: number | string | null;
  idusuario?: number | string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  user_id?: number | string | null;
  userId?: number | string | null;
  codigo?: number | string | null;
  nome_completo?: string | null;
  nome?: string | null;
  nome_usuario?: string | null;
  nomeusuario?: string | null;
  nomeUsuario?: string | null;
  nome_usuario_completo?: string | null;
  email?: string | null;
  oab?: string | null;
  oab_number?: string | null;
  oabNumber?: string | null;
  oab_numero?: string | null;
  oabNumero?: string | null;
  oab_uf?: string | null;
  oabUf?: string | null;
};

type ApiMonitoredOab = {
  id?: number | string | null;
  uf?: string | null;
  numero?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  usuario_nome?: string | null;
  usuarioNome?: string | null;
  usuario_oab_numero?: string | null;
  usuarioOabNumero?: string | null;
  usuario_oab_uf?: string | null;
  usuarioOabUf?: string | null;
  dias_semana?: unknown;
  diasSemana?: unknown;
  sync_from?: string | null;
  syncFrom?: string | null;
};

const DIA_SEMANA_LABELS: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  7: "Domingo",
};

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

const BUSINESS_DAY_VALUES = [1, 2, 3, 4, 5] as const;
const DEFAULT_MONITOR_DAYS = [...BUSINESS_DAY_VALUES];
const BUSINESS_DAY_SET = new Set<number>(BUSINESS_DAY_VALUES);

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

const getNameFromEmail = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [localPart] = value.split("@");
  if (!localPart) {
    return null;
  }

  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

const extractCompanyUserArray = (payload: unknown): ApiCompanyUser[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiCompanyUser => Boolean(item && typeof item === "object"));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const visited = new Set<object>();
  const queue: unknown[] = [payload];
  const candidateKeys = [
    "usuarios",
    "usuarios_empresa",
    "usuariosEmpresa",
    "usuariosEmpresaRows",
    "lista",
    "items",
    "result",
    "results",
    "records",
    "rows",
    "data",
    "values",
    "payload",
    "content",
    "body",
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }

    visited.add(current as object);

    for (const key of candidateKeys) {
      const value = (current as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        const objects = value.filter((item): item is ApiCompanyUser => Boolean(item && typeof item === "object"));
        if (objects.length > 0) {
          return objects;
        }
      }
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            queue.push(item);
          }
        }
      } else if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return [];
};

const extractCompanyUserId = (user: ApiCompanyUser): string | null => {
  const candidates: Array<number | string | null | undefined> = [
    user.id,
    user.id_usuario,
    user.idUsuario,
    user.idusuario,
    user.usuario_id,
    user.usuarioId,
    user.user_id,
    user.userId,
    user.codigo,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(Math.trunc(candidate));
    }

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

const sanitizeUfValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
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
): { number: string | null; uf: string | null } => {
  if (typeof value !== "string") {
    return { number: null, uf: null };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { number: null, uf: null };
  }

  const normalized = trimmed.replace(/^OAB\s*/i, "");

  if (normalized.includes("/")) {
    const [left, right] = normalized.split("/");
    const number = sanitizeOabNumberValue(left);
    const uf = sanitizeUfValue(right);
    return { number, uf };
  }

  const match = normalized.match(/([A-Za-z]{2})[^A-Za-z0-9]*([0-9]+)/);

  if (match) {
    const [, ufRaw, numberRaw] = match;
    return {
      number: sanitizeOabNumberValue(numberRaw),
      uf: sanitizeUfValue(ufRaw),
    };
  }

  return { number: sanitizeOabNumberValue(normalized), uf: null };
};

const extractCompanyUserOab = (
  user: ApiCompanyUser,
): { number: string | null; uf: string | null } => {
  const explicitNumber = sanitizeOabNumberValue(
    pickFirstNonEmptyString(user.oab_number, user.oabNumber, user.oab_numero, user.oabNumero),
  );
  const explicitUf = sanitizeUfValue(pickFirstNonEmptyString(user.oab_uf, user.oabUf));

  let number = explicitNumber;
  let uf = explicitUf;

  if (!number || !uf) {
    const combined = extractCombinedOabData(user.oab);
    if (!number && combined.number) {
      number = combined.number;
    }
    if (!uf && combined.uf) {
      uf = combined.uf;
    }
  }

  return { number, uf };
};

const parseCompanyUsers = (payload: unknown): CompanyUserOption[] => {
  const data = extractCompanyUserArray(payload);
  const options: CompanyUserOption[] = [];
  const seen = new Set<string>();

  for (const user of data) {
    const id = extractCompanyUserId(user);
    if (!id || seen.has(id)) {
      continue;
    }

    const name =
      pickFirstNonEmptyString(
        user.nome_completo,
        user.nome,
        user.nome_usuario,
        user.nomeusuario,
        user.nomeUsuario,
        user.nome_usuario_completo,
      ) ?? getNameFromEmail(user.email) ?? `Usuário ${id}`;

    const { number, uf } = extractCompanyUserOab(user);

    options.push({
      id,
      name,
      oabNumber: number,
      oabUf: uf,
    });
    seen.add(id);
  }

  return options;
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

  if (
    normalized.length === BUSINESS_DAY_VALUES.length &&
    BUSINESS_DAY_VALUES.every((value, index) => value === normalized[index])
  ) {
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

const mapApiMonitoredOab = (payload: unknown): MonitoredOab | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as ApiMonitoredOab;

  const rawId = data.id;
  let id: string | null = null;

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    id = String(Math.trunc(rawId));
  } else if (typeof rawId === "string") {
    const trimmed = rawId.trim();
    if (trimmed) {
      id = trimmed;
    }
  }

  if (!id) {
    return null;
  }

  const uf = typeof data.uf === "string" ? data.uf.trim().toUpperCase() : null;
  const numero = typeof data.numero === "string" ? data.numero.trim() : null;

  if (!uf || !numero) {
    return null;
  }

  const usuarioIdCandidate = data.usuarioId ?? data.usuario_id ?? null;
  let usuarioId: string | null = null;

  if (typeof usuarioIdCandidate === "number" && Number.isFinite(usuarioIdCandidate)) {
    usuarioId = String(Math.trunc(usuarioIdCandidate));
  } else if (typeof usuarioIdCandidate === "string") {
    const trimmed = usuarioIdCandidate.trim();
    if (trimmed) {
      usuarioId = trimmed;
    }
  }

  const usuarioNome = pickFirstNonEmptyString(data.usuarioNome as string, data.usuario_nome as string);
  const usuarioOabNumero = pickFirstNonEmptyString(
    data.usuarioOabNumero as string,
    data.usuario_oab_numero as string,
  );
  const usuarioOabUf = sanitizeUfValue(
    pickFirstNonEmptyString(data.usuarioOabUf as string, data.usuario_oab_uf as string),
  );

  const createdAt = pickFirstNonEmptyString(data.createdAt as string, data.created_at as string);
  const updatedAt = pickFirstNonEmptyString(data.updatedAt as string, data.updated_at as string);
  const syncFrom = parseApiSyncFrom(data.syncFrom ?? data.sync_from ?? null);
  const diasSemanaRaw = (data.diasSemana ?? data.dias_semana) as unknown;

  return {
    id,
    uf,
    number: numero,
    usuarioId,
    usuarioNome: usuarioNome ?? null,
    usuarioOabNumero: usuarioOabNumero ?? null,
    usuarioOabUf: usuarioOabUf ?? null,
    createdAt: createdAt ?? null,
    updatedAt: updatedAt ?? null,
    syncFrom,
    diasSemana: parseApiDiasSemana(diasSemanaRaw),
  };
};

const parseMonitoredOabArray = (payload: unknown): MonitoredOab[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => mapApiMonitoredOab(item))
    .filter((item): item is MonitoredOab => Boolean(item));
};

const sortMonitoredOabs = (items: MonitoredOab[]): MonitoredOab[] => {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (timeA !== timeB) {
      return timeB - timeA;
    }

    const idA = Number.parseInt(a.id, 10);
    const idB = Number.parseInt(b.id, 10);

    if (Number.isFinite(idA) && Number.isFinite(idB)) {
      return idB - idA;
    }

    return b.id.localeCompare(a.id);
  });
};

const formatDateTimeToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Sem registros";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const formatMonitoredOabDisplay = (numero: string, uf: string): string => {
  const digits = numero.replace(/\D/g, "").slice(0, 12);
  const formattedNumber = digits ? digits.padStart(6, "0") : numero;
  const trimmedUf = uf.trim();
  const normalizedUf = sanitizeUfValue(trimmedUf) ?? trimmedUf.toUpperCase();
  return trimmedUf ? `${formattedNumber}/${normalizedUf}` : formattedNumber;
};

const allowedRichTextTags = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "a",
  "hr",
]);

const allowedRichTextAttributes = new Map<string, Set<string>>([
  [
    "a",
    new Set(["href", "title", "target", "rel"]),
  ],
  [
    "span",
    new Set(["style"]),
  ],
  [
    "div",
    new Set(["style"]),
  ],
  [
    "p",
    new Set(["style"]),
  ],
  [
    "table",
    new Set(["style"]),
  ],
  [
    "thead",
    new Set(["style"]),
  ],
  [
    "tbody",
    new Set(["style"]),
  ],
  [
    "tr",
    new Set(["style"]),
  ],
  [
    "td",
    new Set(["style", "colspan", "rowspan", "align"]),
  ],
  [
    "th",
    new Set(["style", "colspan", "rowspan", "align"]),
  ],
  [
    "ul",
    new Set(["style"]),
  ],
  [
    "ol",
    new Set(["style"]),
  ],
  [
    "li",
    new Set(["style"]),
  ],
]);

const htmlEntityMap: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeHtmlEntities(value: string): string {
  if (!value) {
    return value;
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const documentFragment = parser.parseFromString(`<!doctype html><body>${value}`, "text/html");
      return documentFragment.body.innerHTML || value;
    } catch {
      // ignore parser errors and fallback to other strategies
    }
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value.replace(/&(lt|gt|amp|quot|#39);/g, (match) => htmlEntityMap[match] ?? match);
}

function sanitizeStyleAttribute(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (/(expression|javascript:|vbscript:|data:|url\s*\()/i.test(normalized)) {
    return null;
  }

  return normalized.replace(/\s{2,}/g, " ");
}

function sanitizeIntimacaoHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(html, "text/html");

  if (parsedDocument.querySelector("parsererror")) {
    return html;
  }

  const unwrapElement = (element: Element) => {
    const parent = element.parentNode;

    if (!parent) {
      element.remove();
      return;
    }

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  };

  const elements = Array.from(parsedDocument.body.querySelectorAll("*"));

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (!allowedRichTextTags.has(tagName)) {
      unwrapElement(element);
      return;
    }

    const allowedAttributes = allowedRichTextAttributes.get(tagName);

    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();

      if (!allowedAttributes || !allowedAttributes.has(attributeName)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (attributeName === "href") {
        const value = attribute.value.trim();

        if (!value || /^(javascript:|data:)/i.test(value)) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (/^https?:/i.test(value)) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }

      if (attributeName === "target") {
        const value = attribute.value.trim();
        if (value !== "_blank" && value !== "_self") {
          element.setAttribute("target", "_blank");
        }
      }

      if (attributeName === "rel") {
        const tokens = attribute.value
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean);
        const normalized = new Set(tokens);
        normalized.add("noopener");
        normalized.add("noreferrer");
        element.setAttribute("rel", Array.from(normalized).join(" "));
      }

      if (attributeName === "style") {
        const sanitized = sanitizeStyleAttribute(attribute.value);

        if (!sanitized) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, sanitized);
        }
      }
    });
  });

  return parsedDocument.body.innerHTML;
}

type NormalizedRichText =
  | { type: "html"; value: string }
  | { type: "text"; value: string };

function normalizeRichText(value: string | null | undefined): NormalizedRichText | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const decoded = decodeHtmlEntities(trimmed);

  if (/[<>]/.test(decoded)) {
    const sanitized = sanitizeIntimacaoHtml(decoded);

    if (sanitized && sanitized.trim()) {
      return { type: "html", value: sanitized };
    }

    const stripped = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped ? { type: "text", value: stripped } : null;
  }

  return { type: "text", value: decoded };
}

function prepararResumoIa(conteudo?: string | null): string | null {
  if (!conteudo) {
    return null;
  }

  const textoNormalizado = normalizarTexto(conteudo);

  if (!textoNormalizado) {
    return null;
  }

  const paragrafoUnico = textoNormalizado
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!paragrafoUnico) {
    return null;
  }

  const frases = paragrafoUnico
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.trim().length > 0);
  let frasesParaResumo = frases;

  if (frases.length > 0) {
    const primeiraFraseNormalizada = frases[0].trim().toLowerCase();
    const prefixosRemoviveis = ["resumo", "síntese", "este documento"];

    if (prefixosRemoviveis.some((prefixo) => primeiraFraseNormalizada.startsWith(prefixo))) {
      const restantes = frases.slice(1);
      frasesParaResumo = restantes.length > 0 ? restantes : frases;
    }
  }

  const resumoConciso = frasesParaResumo.slice(0, 2).join(" ") || paragrafoUnico;

  const resumoLimpo = resumoConciso.replace(/\*\*/g, "");

  return resumoLimpo || resumoConciso;
}

function montarPromptResumoIntimacao(intimacao: Intimacao): string {
  const partes: string[] = [
    "Você é um Assistente Jurídico de Elite. Sua função é ler a publicação judicial abaixo e extrair as informações críticas para o advogado, com foco total em Prazos e Providências.",
    "",
    "INSTRUCÕES DE ANÁLISE:",
    "1. IDENTIFICAÇÃO DO ATO: Defina se é Sentença, Despacho, Decisão, Ato Ordinatório ou Intimação Simples.",
    "2. PRAZOS E AUDIÊNCIAS: Busque ativamente por menções a prazos (em dias ou datas), datas de audiências ou perícias. Se houver prazo, tente inferir o termo inicial (ex: da publicação, da juntada).",
    "3. AÇÃO REQUERIDA: O que o advogado precisa fazer? (Pagar custas, apresentar defesa, comparecer em audiência, ciência apenas, etc).",
    "4. PONTOS CRÍTICOS: Identifique multas, decretação de revelia, arquivamento ou outras penalidades iminentes.",
    "",
    "FORMATO DE RESPOSTA (Use Markdown):",
    "Retorne APENAS os tópicos abaixo. Seja conciso. Use negrito para destacar prazos e valores.",
    "",
    "- **Natureza do Ato**: [Tipo do ato]",
    "- **Síntese**: [Resumo direto do conteúdo em 1 ou 2 frases]",
    "- **Providência**: [Ação concreta que o advogado deve tomar]",
    "- **Prazos/Datas**: [Liste prazos, datas de audiência ou 'Sem prazo definido']",
    "- **Observações**: [Riscos ou instruções específicas, se houver]",
  ];

  const numeroProcesso =
    typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
  const tipoComunicacao =
    typeof intimacao.tipoComunicacao === "string" ? intimacao.tipoComunicacao.trim() : "";
  const tribunal = typeof intimacao.siglaTribunal === "string" ? intimacao.siglaTribunal.trim() : "";
  const orgao = typeof intimacao.nomeOrgao === "string" ? intimacao.nomeOrgao.trim() : "";
  const prazo = typeof intimacao.prazo === "string" ? intimacao.prazo.trim() : "";

  const metadata: string[] = [];
  if (numeroProcesso) metadata.push(`Processo: ${numeroProcesso}`);
  if (tipoComunicacao) metadata.push(`Tipo de comunicação: ${tipoComunicacao}`);
  if (tribunal) metadata.push(`Tribunal: ${tribunal}`);
  if (orgao) metadata.push(`Órgão: ${orgao}`);
  if (prazo) metadata.push(`Prazo no sistema: ${prazo}`);

  if (metadata.length > 0) {
    partes.push("--- DADOS DO SISTEMA ---");
    partes.push(metadata.join("\n"));
  }

  const conteudoNormalizado = normalizarTexto(intimacao.texto);
  partes.push("--- TEOR DA INTIMAÇÃO ---");
  partes.push(conteudoNormalizado || "Sem texto disponível.");

  return partes.filter(Boolean).join("\n\n");
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

// function normalizeDestinatarios(raw: unknown): NormalizedDestinatario[] {
//   if (!Array.isArray(raw)) {
//     return [];
//   }

//   return raw
//     .map((item) => parseMaybeJson(item))
//     .map((item) => {
//       if (typeof item === "string") {
//         const nome = item.trim();
//         return nome ? { nome } : null;
//       }

//       if (item && typeof item === "object") {
//         const record = item as Record<string, unknown>;
//         const nome = typeof record.nome === "string" ? record.nome.trim() : undefined;
//         const polo = typeof record.polo === "string" ? record.polo.trim() : undefined;

//         if (nome) {
//           const res: NormalizedDestinatario = {
//             nome,
//             polo: polo && polo.length > 0 ? polo : undefined,
//           };
//           return res;
//         }
//       }

//       return null;
//     })
//     .filter((value): value is NormalizedDestinatario => value !== null);
// }

// function normalizeDestinatariosAdvogados(raw: unknown): NormalizedAdvogado[] {
//   if (!Array.isArray(raw)) {
//     return [];
//   }

//   return raw
//     .map((item) => parseMaybeJson(item))
//     .map((item) => {
//       if (!item || typeof item !== "object") {
//         return null;
//       }

//       const record = item as Record<string, unknown>;
//       const advogadoValue = "advogado" in record ? parseMaybeJson(record.advogado) : record;

//       if (!advogadoValue || typeof advogadoValue !== "object") {
//         return null;
//       }

//       const advogado = advogadoValue as Record<string, unknown>;
//       const nome = typeof advogado.nome === "string" ? advogado.nome.trim() : undefined;

//       const numero =
//         typeof advogado.numero_oab === "string" || typeof advogado.numero_oab === "number"
//           ? String(advogado.numero_oab).trim()
//           : typeof advogado.numeroOab === "string"
//             ? advogado.numeroOab.trim()
//             : undefined;

//       const uf =
//         typeof advogado.uf_oab === "string"
//           ? advogado.uf_oab.trim()
//           : typeof advogado.ufOab === "string"
//             ? advogado.ufOab.trim()
//             : undefined;

//       if (!nome) {
//         return null;
//       }

//       const res: NormalizedAdvogado = {
//         nome,
//         numeroOab: numero && numero.length > 0 ? numero : undefined,
//         ufOab: uf && uf.length > 0 ? uf : undefined,
//       };
//       return res;
//     })
//     .filter((value): value is NormalizedAdvogado => value !== null);
// }

// BETTER IMPLEMENTATION THAT AVOIDS THE TYPE PREDICATE ISSUES COMPLETELY
function normalizeDestinatarios(raw: unknown): NormalizedDestinatario[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: NormalizedDestinatario[] = [];

  for (const item of raw) {
    const parsed = parseMaybeJson(item);

    if (typeof parsed === "string") {
      const nome = parsed.trim();
      if (nome) {
        result.push({ nome });
      }
      continue;
    }

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const nome = typeof record.nome === "string" ? record.nome.trim() : undefined;
      const polo = typeof record.polo === "string" ? record.polo.trim() : undefined;

      if (nome) {
        result.push({
          nome,
          polo: polo && polo.length > 0 ? polo : undefined,
        });
      }
    }
  }

  return result;
}

function normalizeDestinatariosAdvogados(raw: unknown): NormalizedAdvogado[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: NormalizedAdvogado[] = [];

  for (const item of raw) {
    const parsed = parseMaybeJson(item);

    if (!parsed || typeof parsed !== "object") {
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const advogadoValue = "advogado" in record ? parseMaybeJson(record.advogado) : record;

    if (!advogadoValue || typeof advogadoValue !== "object") {
      continue;
    }

    const advogado = advogadoValue as Record<string, unknown>;
    const nome = typeof advogado.nome === "string" ? advogado.nome.trim() : undefined;

    const numero =
      typeof advogado.numero_oab === "string" || typeof advogado.numero_oab === "number"
        ? String(advogado.numero_oab).trim()
        : typeof advogado.numeroOab === "string"
          ? advogado.numeroOab.trim()
          : undefined;

    const uf =
      typeof advogado.uf_oab === "string"
        ? advogado.uf_oab.trim()
        : typeof advogado.ufOab === "string"
          ? advogado.ufOab.trim()
          : undefined;

    if (nome) {
      result.push({
        nome,
        numeroOab: numero && numero.length > 0 ? numero : undefined,
        ufOab: uf && uf.length > 0 ? uf : undefined,
      });
    }
  }

  return result;
}

function formatAdvogadoLabel(advogado: NormalizedAdvogado): string {
  const parts = [advogado.nome];
  const oab = [advogado.ufOab ?? "", advogado.numeroOab ?? ""].filter((value) => value).join("-");

  if (oab) {
    parts.push(`OAB ${oab}`);
  }

  return parts.join(" • ");
}

function createAdvogadoKey(advogado: NormalizedAdvogado): string {
  return [advogado.nome, advogado.ufOab ?? "", advogado.numeroOab ?? ""].join("|");
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function formatDateOrText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  }

  return value;
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function hasContent(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasContent(item));
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return true;
}

function InfoItem({ label, children }: { label: string; children?: ReactNode }) {
  if (!hasContent(children ?? null)) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function Intimacoes() {
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"read" | "archive" | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    search: "",
    advogado: "all",
    periodo: "all",
    situacao: "ativas",
    tribunal: "all",
    tipo: "all",
  });
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryTarget, setSummaryTarget] = useState<Intimacao | null>(null);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [monitoredOabs, setMonitoredOabs] = useState<MonitoredOab[]>([]);
  const [monitoredOabsLoading, setMonitoredOabsLoading] = useState(false);
  const [monitoredOabsLoaded, setMonitoredOabsLoaded] = useState(false);
  const [monitoredOabsError, setMonitoredOabsError] = useState<string | null>(null);
  const [oabModalOpen, setOabModalOpen] = useState(false);
  const [oabUf, setOabUf] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabDiasSemana, setOabDiasSemana] = useState<number[]>(DEFAULT_MONITOR_DAYS);
  const [oabSyncFromMode, setOabSyncFromMode] = useState<"all" | "date">("all");
  const [oabSyncFromDate, setOabSyncFromDate] = useState<Date | null>(null);
  const [oabSyncFromCalendarOpen, setOabSyncFromCalendarOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [oabSubmitting, setOabSubmitting] = useState(false);
  const [oabSyncingProcesses, setOabSyncingProcesses] = useState(false);
  const [oabSubmitError, setOabSubmitError] = useState<ReactNode | null>(null);
  const [removingOabId, setRemovingOabId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserOption[]>([]);
  const [companyUsersLoading, setCompanyUsersLoading] = useState(false);
  const [companyUsersError, setCompanyUsersError] = useState<string | null>(null);
  const summaryRequestIdRef = useRef(0);
  const oabPromptShownRef = useRef(false);
  const companyUsersLoadedRef = useRef(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Intimacao | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan } = usePlan();
  const canManageOabs = monitoredOabsLoaded && monitoredOabs.length === 0;
  const canSubmitOab = !loading;

  const loadIntimacoes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchIntimacoes(signal);
      setIntimacoes(data);
      setPage(1);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Não foi possível carregar as intimações.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadMonitoredOabs = useCallback(
    async (signal?: AbortSignal) => {
      setMonitoredOabsLoading(true);
      setMonitoredOabsError(null);
      setMonitoredOabsLoaded(false);

      try {
        const response = await fetch(getApiUrl("intimacoes/oab-monitoradas"), {
          signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Não foi possível carregar as OABs monitoradas (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        if (signal?.aborted) {
          return;
        }

        const monitors = sortMonitoredOabs(parseMonitoredOabArray(payload));
        setMonitoredOabs(monitors);
        setMonitoredOabsError(null);
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }

        console.error("Falha ao carregar OABs monitoradas", loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as OABs monitoradas.";
        setMonitoredOabsError(message);
        toast({
          title: "Erro ao carregar OABs monitoradas",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!signal?.aborted) {
          setMonitoredOabsLoading(false);
          setMonitoredOabsLoaded(true);
        }
      }
    },
    [toast],
  );

  const loadCompanyUsers = useCallback(
    async (signal?: AbortSignal) => {
      setCompanyUsersLoading(true);
      setCompanyUsersError(null);

      try {
        const endpoints = ["get_api_usuarios_empresa", "usuarios/empresa"] as const;
        let users: CompanyUserOption[] | null = null;
        let lastError: Error | null = null;

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(getApiUrl(endpoint), {
              signal,
              headers: { Accept: "application/json" },
            });

            if (!response.ok) {
              lastError = new Error(
                `Não foi possível carregar os usuários da empresa (HTTP ${response.status}).`,
              );
              continue;
            }

            const payload = await response.json();

            if (signal?.aborted) {
              return;
            }

            const parsed = parseCompanyUsers(payload);

            if (parsed.length === 0 && endpoint !== endpoints[endpoints.length - 1]) {
              lastError = new Error("Nenhum usuário encontrado.");
              continue;
            }

            users = parsed;
            lastError = null;
            break;
          } catch (error) {
            if (signal?.aborted) {
              return;
            }

            lastError =
              error instanceof Error
                ? error
                : new Error("Não foi possível carregar os usuários da empresa.");
          }
        }

        if (signal?.aborted) {
          return;
        }

        if (users) {
          setCompanyUsers(users);
          companyUsersLoadedRef.current = true;
          setCompanyUsersError(null);
          return;
        }

        if (lastError) {
          throw lastError;
        }

        throw new Error("Não foi possível carregar os usuários da empresa.");
      } catch (usersError) {
        if (signal?.aborted) {
          return;
        }

        console.error("Falha ao carregar usuários da empresa", usersError);
        const message =
          usersError instanceof Error
            ? usersError.message
            : "Não foi possível carregar os usuários da empresa.";
        setCompanyUsersError(message);
        toast({
          title: "Erro ao carregar usuários",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!signal?.aborted) {
          setCompanyUsersLoading(false);
        }
      }
    },
    [companyUsersLoadedRef, toast],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadIntimacoes(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadIntimacoes]);

  useEffect(() => {
    const controller = new AbortController();
    loadMonitoredOabs(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadMonitoredOabs]);

  useEffect(() => {
    if (companyUsersLoadedRef.current) {
      return;
    }

    const controller = new AbortController();
    loadCompanyUsers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadCompanyUsers]);

  useEffect(() => {
    if (!oabModalOpen || companyUsersLoadedRef.current) {
      return;
    }

    const controller = new AbortController();
    loadCompanyUsers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadCompanyUsers, oabModalOpen]);

  useEffect(() => {
    if (canManageOabs && !oabPromptShownRef.current) {
      oabPromptShownRef.current = true;
      setOabModalOpen(true);
    }
  }, [canManageOabs]);

  const handleGenerateSummary = useCallback(
    async (intimacao: Intimacao, requestId: number) => {
      setSummaryLoading(true);
      setSummaryError(null);
      setSummaryContent(null);

      const textoParaResumo = normalizarTexto(intimacao.texto);

      if (!textoParaResumo) {
        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryLoading(false);
        setSummaryError("Não há conteúdo disponível para resumir.");
        return;
      }

      try {
        const integracoes = await fetchIntegrationApiKeys();
        const integracaoAtiva = integracoes.find(
          (integracao) =>
            integracao.active && ["gemini", "openai"].includes(integracao.provider.trim().toLowerCase()),
        );

        if (!integracaoAtiva) {
          throw new Error("Nenhuma integração de IA ativa disponível. Acesse o Menu Integrações e insira sua chave de API ou entre em contato com o suporte para verificar nossos planos.");
        }

        const promptResumo = montarPromptResumoIntimacao(intimacao);
        const resposta = await generateAiText({
          integrationId: integracaoAtiva.id,
          documentType: "Resumo:",
          prompt: promptResumo,
          mode: "summary",
        });

        const conteudoResumo = resposta.content?.trim();
        const resumoFormatado = prepararResumoIa(conteudoResumo);

        if (!resumoFormatado) {
          throw new Error("Não foi possível gerar um resumo com o conteúdo disponível.");
        }

        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryContent(resumoFormatado);

        const providerLabel =
          integracaoAtiva.provider.trim().toLowerCase() === "gemini"
            ? "Gemini"
            : integracaoAtiva.provider.trim().toLowerCase() === "openai"
              ? "OpenAI"
              : integracaoAtiva.provider;

        toast({
          title: "Resumo gerado",
          description: `Resumo gerado com inteligência artificial. Pode conter imprecisões; recomenda-se revisão.`,
        });
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Não foi possível gerar o resumo.";
        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryError(mensagem);
        toast({
          title: "Falha ao gerar resumo",
          description: mensagem,
          variant: "destructive",
        });
      } finally {
        if (summaryRequestIdRef.current === requestId) {
          setSummaryLoading(false);
        }
      }
    },
    [toast],
  );

  const startSummaryGeneration = useCallback(
    (intimacao: Intimacao) => {
      const nextRequestId = summaryRequestIdRef.current + 1;
      summaryRequestIdRef.current = nextRequestId;
      void handleGenerateSummary(intimacao, nextRequestId);
    },
    [handleGenerateSummary],
  );

  const handleOpenSummary = useCallback(
    (intimacao: Intimacao) => {
      setSummaryTarget(intimacao);
      setSummaryDialogOpen(true);
      startSummaryGeneration(intimacao);
    },
    [startSummaryGeneration],
  );

  const handleSummaryDialogChange = useCallback((open: boolean) => {
    setSummaryDialogOpen(open);

    if (!open) {
      summaryRequestIdRef.current += 1;
      setSummaryTarget(null);
      setSummaryContent(null);
      setSummaryError(null);
      setSummaryLoading(false);
    }
  }, []);

  const applyReadUpdates = useCallback(
    (updates: Map<string, MarkIntimacaoAsReadResponse>) => {
      if (updates.size === 0) {
        return;
      }

      setIntimacoes((prev) =>
        prev.map((item) => {
          const update = updates.get(String(item.id));
          if (!update) {
            return item;
          }

          return {
            ...item,
            nao_lida: update.nao_lida,
            updated_at: update.updated_at,
            idusuario_leitura: update.idusuario_leitura ?? null,
            lida_em: update.lida_em ?? null,
          };
        }),
      );

      setDetailsTarget((prev) => {
        if (!prev) {
          return prev;
        }

        const update = updates.get(String(prev.id));
        if (!update) {
          return prev;
        }

        return {
          ...prev,
          nao_lida: update.nao_lida,
          updated_at: update.updated_at,
          idusuario_leitura: update.idusuario_leitura ?? null,
          lida_em: update.lida_em ?? null,
        };
      });
    },
    [setIntimacoes, setDetailsTarget],
  );

  const applyReadUpdate = useCallback(
    (result: MarkIntimacaoAsReadResponse) => {
      applyReadUpdates(new Map([[String(result.id), result]]));
    },
    [applyReadUpdates],
  );

  const handleOpenDetails = useCallback(
    (intimacao: Intimacao) => {
      setDetailsTarget(intimacao);
      setDetailsDialogOpen(true);

      if (intimacao.nao_lida) {
        void (async () => {
          try {
            const result = await markIntimacaoAsRead(intimacao.id);
            applyReadUpdate(result);
          } catch (error) {
            console.error('Falha ao marcar intimação como lida ao abrir detalhes', error);
          }
        })();
      }
    },
    [applyReadUpdate],
  );

  const handleDetailsDialogChange = useCallback((open: boolean) => {
    setDetailsDialogOpen(open);

    if (!open) {
      setDetailsTarget(null);
    }
  }, []);

  const handleOpenOabModal = useCallback(() => {
    setOabSubmitError(null);
    setOabNumber("");
    setOabUf("");
    setSelectedUserId("");
    setRemovingOabId(null);
    setOabDiasSemana(DEFAULT_MONITOR_DAYS);
    setOabSyncFromMode("all");
    setOabSyncFromDate(null);
    setOabSyncFromCalendarOpen(false);
    setOabModalOpen(true);
  }, []);

  const handleOabModalChange = useCallback((open: boolean) => {
    setOabModalOpen(open);

    if (!open) {
      setOabNumber("");
      setOabUf("");
      setSelectedUserId("");
      setRemovingOabId(null);
      setOabSubmitting(false);
      setOabSubmitError(null);
      setOabDiasSemana(DEFAULT_MONITOR_DAYS);
      setOabSyncFromMode("all");
      setOabSyncFromDate(null);
      setOabSyncFromCalendarOpen(false);
    }
  }, []);

  const handleSelectCompanyUser = useCallback(
    (value: string) => {
      setSelectedUserId(value);
      setOabSubmitError(null);

      const option = companyUsers.find((item) => item.id === value);

      if (!option) {
        setOabDiasSemana(DEFAULT_MONITOR_DAYS);
        setOabSyncFromMode("all");
        setOabSyncFromDate(null);
        setOabSyncFromCalendarOpen(false);
        return;
      }

      setOabNumber(option.oabNumber ?? "");
      setOabUf(option.oabUf ?? "");
      if (!option.oabNumber || !option.oabUf) {
        setOabSubmitError(
          <>
            O responsável selecionado não possui OAB válida para monitoramento. Complemente o seu cadastro{" "}
            <Link to="/meu-perfil" className="underline">
              clicando aqui
            </Link>{" "}
            para cadastrar o registro da sua OAB.
          </>,
        );
        setOabDiasSemana(DEFAULT_MONITOR_DAYS);
        setOabSyncFromMode("all");
        setOabSyncFromDate(null);
        setOabSyncFromCalendarOpen(false);
        return;
      }

      const normalizedUf = sanitizeUfValue(option.oabUf) ?? option.oabUf.toUpperCase();
      const normalizedNumber = (option.oabNumber ?? "").replace(/\D/g, "");

      if (normalizedUf && normalizedNumber) {
        const existingMonitor = monitoredOabs.find((monitor) => {
          const monitorNumber = monitor.number.replace(/\D/g, "");
          return monitor.uf === normalizedUf && monitorNumber === normalizedNumber;
        });

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
    [companyUsers, monitoredOabs],
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

  const handleRegisterOab = useCallback(async () => {
    const sanitizedNumber = oabNumber.replace(/\D/g, "");

    const sanitizedUf = oabUf.trim().toUpperCase();

    if (plan?.limits.oabs && monitoredOabs.length >= plan.limits.oabs) {
      setOabSubmitError(`Você atingiu o limite de ${plan.limits.oabs} OABs monitoradas do seu plano.`);
      return;
    }

    const parsedUserId = Number.parseInt(selectedUserId, 10);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      setOabSubmitError("Selecione o responsável pela OAB.");
      return;
    }

    if (!sanitizedNumber || !sanitizedUf) {
      setOabSubmitError(
        <>
          O responsável selecionado não possui OAB válida para monitoramento. Complemente o seu cadastro{" "}
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
    setOabSubmitting(true);

    try {
      const syncFromPayload =
        oabSyncFromMode === "date" && oabSyncFromDate ? toIsoDateString(oabSyncFromDate) : null;
      const response = await fetch(getApiUrl("intimacoes/oab-monitoradas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uf: sanitizedUf,
          numero: sanitizedNumber,
          usuarioId: parsedUserId,
          diasSemana: oabDiasSemana,
          syncFrom: syncFromPayload,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : `Não foi possível cadastrar a OAB (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const payload = await response.json();
      const monitor = mapApiMonitoredOab(payload);

      if (!monitor) {
        throw new Error("Não foi possível interpretar a resposta ao cadastrar a OAB.");
      }

      setMonitoredOabs((previous) => {
        const filtered = previous.filter((item) => item.id !== monitor.id);
        return sortMonitoredOabs([monitor, ...filtered]);
      });

      toast({
        title: "OAB cadastrada",
        description: `Monitoramento ativado para ${formatMonitoredOabDisplay(monitor.number, monitor.uf)}.`,
      });

      handleOabModalChange(false);
      setOabSyncingProcesses(true);
      try {
        await loadIntimacoes();
      } finally {
        setOabSyncingProcesses(false);
      }

      setOabSubmitError(null);
      setOabNumber("");
      setOabUf("");
      setSelectedUserId("");
      setOabDiasSemana(DEFAULT_MONITOR_DAYS);
    } catch (registerError) {
      const message =
        registerError instanceof Error
          ? registerError.message
          : "Não foi possível cadastrar a OAB informada.";
      setOabSubmitError(message);
      toast({
        title: "Erro ao cadastrar OAB",
        description: message,
        variant: "destructive",
      });
    } finally {
      setOabSubmitting(false);
    }
  }, [
    oabNumber,
    oabUf,
    oabDiasSemana,
    oabSyncFromMode,
    oabSyncFromDate,
    selectedUserId,
    toast,
    handleOabModalChange,
    loadIntimacoes,
    monitoredOabs,
    plan,
  ]);

  const handleRemoveMonitoredOab = useCallback(
    async (id: string) => {
      if (!id) {
        return;
      }

      setRemovingOabId(id);

      try {
        const response = await fetch(getApiUrl(`intimacoes/oab-monitoradas/${id}`), {
          method: "DELETE",
        });

        if (response.status !== 204) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && payload && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Não foi possível remover a OAB (HTTP ${response.status}).`;
          throw new Error(message);
        }

        setMonitoredOabs((previous) => previous.filter((item) => item.id !== id));
        toast({
          title: "OAB removida",
          description: "O monitoramento foi encerrado.",
        });
      } catch (removeError) {
        const message =
          removeError instanceof Error
            ? removeError.message
            : "Não foi possível remover a OAB monitorada.";
        toast({
          title: "Erro ao remover OAB",
          description: message,
          variant: "destructive",
        });
      } finally {
        setRemovingOabId(null);
      }
    },
    [toast],
  );

  const sortedIntimacoes = useMemo(() => {
    return [...intimacoes].sort((a, b) => {
      const dateA =
        parseDateValue(a.data_disponibilizacao) ??
        parseDateValue(a.created_at) ??
        parseDateValue(a.updated_at);
      const dateB =
        parseDateValue(b.data_disponibilizacao) ??
        parseDateValue(b.created_at) ??
        parseDateValue(b.updated_at);

      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime();
      }

      if (dateA) {
        return -1;
      }

      if (dateB) {
        return 1;
      }

      const idA = typeof a.id === "number" ? a.id : Number(a.id) || 0;
      const idB = typeof b.id === "number" ? b.id : Number(b.id) || 0;
      return idB - idA;
    });
  }, [intimacoes]);

  const companyLawyerMatcher = useMemo(() => {
    const byOab = new Set<string>();
    const byName = new Set<string>();

    companyUsers.forEach((user) => {
      const name = normalizeAdvogadoName(user.name);
      if (name) {
        byName.add(name);
      }

      const number = normalizeAdvogadoOabNumber(user.oabNumber);
      const uf = normalizeAdvogadoUf(user.oabUf);

      if (number && uf) {
        byOab.add(`${uf}|${number}`);
      }
    });

    return { byOab, byName };
  }, [companyUsers]);

  const isCompanyLawyer = useCallback(
    (advogado: NormalizedAdvogado) => {
      const number = normalizeAdvogadoOabNumber(advogado.numeroOab);
      const uf = normalizeAdvogadoUf(advogado.ufOab);

      if (number && uf && companyLawyerMatcher.byOab.has(`${uf}|${number}`)) {
        return true;
      }

      const name = normalizeAdvogadoName(advogado.nome);
      if (name && companyLawyerMatcher.byName.has(name)) {
        return true;
      }

      return false;
    },
    [companyLawyerMatcher],
  );

  const advogadoOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      normalizeDestinatariosAdvogados(item.destinatarios_advogados)
        .filter(isCompanyLawyer)
        .forEach((advogado) => {
          const key = createAdvogadoKey(advogado);

          if (!map.has(key)) {
            map.set(key, formatAdvogadoLabel(advogado));
          }
        });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes, isCompanyLawyer]);

  const tribunalOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      const label = item.siglaTribunal?.trim();

      if (label) {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes]);

  const tipoOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      const label = item.tipoComunicacao?.trim();

      if (label) {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes]);

  const filteredIntimacoes = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const normalizedSearch = filters.search.trim().toLowerCase();
    const normalizedSearchDigits = normalizedSearch.replace(/\D+/g, "");

    return sortedIntimacoes.filter((item) => {
      if (filters.situacao === "ativas" && item.arquivada) {
        return false;
      }

      if (filters.situacao === "arquivadas" && !item.arquivada) {
        return false;
      }

      if (filters.situacao === "nao-lidas" && !item.nao_lida) {
        return false;
      }

      if (filters.tribunal !== "all") {
        const tribunal = item.siglaTribunal?.trim().toLowerCase() ?? "";
        if (tribunal !== filters.tribunal) {
          return false;
        }
      }

      if (filters.tipo !== "all") {
        const tipo = item.tipoComunicacao?.trim().toLowerCase() ?? "";
        if (tipo !== filters.tipo) {
          return false;
        }
      }

      if (normalizedSearch) {
        const processValue = item.numero_processo ?? "";
        const normalizedProcess = processValue.toLowerCase();

        if (!normalizedProcess.includes(normalizedSearch)) {
          const digits = processValue.replace(/\D+/g, "");

          if (!normalizedSearchDigits || !digits.includes(normalizedSearchDigits)) {
            return false;
          }
        }
      }

      if (filters.advogado !== "all") {
        const advogados = normalizeDestinatariosAdvogados(item.destinatarios_advogados).filter(isCompanyLawyer);
        const matches = advogados.some((advogado) => createAdvogadoKey(advogado) === filters.advogado);

        if (!matches) {
          return false;
        }
      }

      if (filters.periodo !== "all") {
        const date =
          parseDateValue(item.data_disponibilizacao) ??
          parseDateValue(item.created_at) ??
          parseDateValue(item.updated_at);

        if (!date) {
          return false;
        }

        const time = date.getTime();

        if (filters.periodo === "7d" && time < nowTime - 7 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (filters.periodo === "30d" && time < nowTime - 30 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (filters.periodo === "90d" && time < nowTime - 90 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (
          filters.periodo === "month"
          && (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [sortedIntimacoes, filters, isCompanyLawyer]);

  const totalPages = Math.max(Math.ceil(filteredIntimacoes.length / ITEMS_PER_PAGE), 1);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedIntimacoes = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredIntimacoes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIntimacoes, page]);

  const summary = useMemo(() => {
    const total = sortedIntimacoes.length;
    let unread = 0;
    let archived = 0;
    let currentMonth = 0;
    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, { year: number; month: number; total: number }>();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    sortedIntimacoes.forEach((item) => {
      if (item.nao_lida) {
        unread += 1;
      }

      if (item.arquivada) {
        archived += 1;
      }

      const statusLabel = item.status?.trim() ?? "Sem status";
      statusMap.set(statusLabel, (statusMap.get(statusLabel) ?? 0) + 1);

      const date =
        parseDateValue(item.data_disponibilizacao) ??
        parseDateValue(item.created_at) ??
        parseDateValue(item.updated_at);

      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const entry =
          monthlyMap.get(key) ?? { year: date.getFullYear(), month: date.getMonth(), total: 0 };
        entry.total += 1;
        monthlyMap.set(key, entry);

        if (date.getMonth() === month && date.getFullYear() === year) {
          currentMonth += 1;
        }
      }
    });

    const statusDistribution = Array.from(statusMap.entries())
      .map(([status, value]) => ({ status, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyDistribution = Array.from(monthlyMap.values())
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year))
      .slice(-6)
      .map((entry) => ({
        label: format(new Date(entry.year, entry.month, 1), "MMM yyyy", { locale: ptBR }),
        total: entry.total,
      }));

    return {
      total,
      unread,
      archived,
      currentMonth,
      active: Math.max(total - archived, 0),
      statusDistribution,
      monthlyDistribution,
    };
  }, [sortedIntimacoes]);

  const paginationRange = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }

    const uniquePages = new Set<number>();
    uniquePages.add(1);
    uniquePages.add(totalPages);

    for (let index = page - 1; index <= page + 1; index += 1) {
      if (index >= 1 && index <= totalPages) {
        uniquePages.add(index);
      }
    }

    return Array.from(uniquePages).sort((a, b) => a - b);
  }, [page, totalPages]);

  const paginationItems = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    let previous = 0;

    paginationRange.forEach((current) => {
      if (previous && current - previous > 1) {
        items.push("ellipsis");
      }

      items.push(current);
      previous = current;
    });

    return items;
  }, [paginationRange]);

  const handleRefresh = useCallback(async () => {
    setError(null);
    setLoading(true);

    let syncError: string | null = null;
    let syncMessage: string | null = null;
    let wasTriggered = false;

    try {
      const result = await syncIntimacoes();
      wasTriggered = Boolean(result.triggered);
      syncMessage = result.message ?? null;
    } catch (syncFailure) {
      syncError =
        syncFailure instanceof Error
          ? syncFailure.message
          : "Não foi possível atualizar as intimações.";
    }

    await loadIntimacoes();

    if (syncError) {
      toast({
        title: "Não foi possível atualizar as intimações",
        description: syncError,
        variant: "destructive",
      });
      return;
    }

    const description = syncMessage
      ? syncMessage
      : wasTriggered
        ? "As intimações foram sincronizadas com sucesso."
        : "Uma sincronização de intimações já está em andamento.";

    toast({
      title: wasTriggered ? "Intimações atualizadas" : "Sincronização em andamento",
      description,
    });
  }, [loadIntimacoes, toast]);

  const handleArchive = async (id: number | string) => {
    const stringId = String(id);
    setArchivingId(stringId);

    try {
      const result = await archiveIntimacao(id);
      setIntimacoes((prev) =>
        prev.map((item) =>
          String(item.id) === String(result.id)
            ? { ...item, arquivada: result.arquivada, updated_at: result.updated_at }
            : item,
        ),
      );
      if (detailsTarget && String(detailsTarget.id) === stringId) {
        setDetailsTarget(null);
        setDetailsDialogOpen(false);
      }
      toast({
        title: "Intimação arquivada",
        description: "Ela foi movida para a lista de intimações arquivadas.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível arquivar a intimação",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setArchivingId(null);
    }
  };

  const handleMarkAsRead = async (id: number | string) => {
    const stringId = String(id);
    setMarkingId(stringId);

    try {
      const result = await markIntimacaoAsRead(id);
      applyReadUpdate(result);
      toast({
        title: "Intimação atualizada",
        description: "Ela foi marcada como lida.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível marcar como lida",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = useCallback(async () => {
    setBulkAction("read");

    try {
      const result = await markAllIntimacoesAsRead();

      if (result.success) {
        toast({
          title: "Intimações atualizadas",
          description: `${result.count} intimações foram marcadas como lidas.`,
        });
        
        // Recarregar para atualizar a UI completamente
        loadIntimacoes();
      }
    } catch (error) {
      toast({
        title: "Não foi possível marcar como lidas",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  }, [loadIntimacoes, toast]);

  const handleArchiveAll = useCallback(async () => {
    const ativos = filteredIntimacoes.filter((item) => !item.arquivada);

    if (ativos.length === 0) {
      return;
    }

    setBulkAction("archive");

    try {
      const resultados = await Promise.allSettled(ativos.map((item) => archiveIntimacao(item.id)));

      const sucedidos = resultados.filter(
        (resultado): resultado is PromiseFulfilledResult<{ id: number; arquivada: boolean; updated_at: string }> =>
          resultado.status === "fulfilled",
      );
      const falhas = resultados.filter((resultado) => resultado.status === "rejected");

      if (sucedidos.length > 0) {
        const atualizacoes = new Map(
          sucedidos.map((resultado) => [String(resultado.value.id), resultado.value] as const),
        );

        setIntimacoes((anteriores) =>
          anteriores.map((item) => {
            const atualizacao = atualizacoes.get(String(item.id));
            if (!atualizacao) {
              return item;
            }
            return {
              ...item,
              arquivada: atualizacao.arquivada,
              updated_at: atualizacao.updated_at,
            };
          }),
        );

        toast({
          title: "Intimações arquivadas",
          description: `${sucedidos.length} intimações foram arquivadas.`,
        });
      }

      if (falhas.length > 0) {
        toast({
          title: "Algumas intimações não foram arquivadas",
          description: "Tente novamente para concluir a operação.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Não foi possível arquivar as intimações",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  }, [filteredIntimacoes, toast]);

  const handleOpenTask = useCallback(
    (intimacao: Intimacao) => {
      const params = new URLSearchParams();
      const numero = typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
      const prazoDate = intimacao.prazo ? new Date(intimacao.prazo) : null;
      const hasValidPrazo = prazoDate && !Number.isNaN(prazoDate.getTime());
      const descricaoPartes: string[] = [];

      if (intimacao.nomeOrgao) {
        descricaoPartes.push(`Órgão: ${intimacao.nomeOrgao}`);
      }

      if (intimacao.tipoComunicacao) {
        descricaoPartes.push(`Tipo: ${intimacao.tipoComunicacao}`);
      }

      if (hasValidPrazo) {
        descricaoPartes.push(`Prazo: ${format(prazoDate!, "dd/MM/yyyy", { locale: ptBR })}`);
        params.set("data", prazoDate!.toISOString());
      }

      const tituloReferencia = numero || String(intimacao.id);
      params.set("origem", "intimacao");
      params.set("titulo", `Tratar intimação ${tituloReferencia}`);

      if (descricaoPartes.length > 0) {
        params.set("descricao", descricaoPartes.join(" • "));
      }

      if (intimacao.tipoComunicacao) {
        params.set("tipo", intimacao.tipoComunicacao);
      }

      if (numero) {
        params.set("processo", numero);
      } else {
        params.set("intimacao", String(intimacao.id));
      }

      const query = params.toString();
      navigate(query ? `/tarefas?${query}` : "/tarefas");
    },
    [navigate],
  );

  const handleAddToAgenda = useCallback(
    (intimacao: Intimacao) => {
      const params = new URLSearchParams();
      const numero = typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
      const prazoDate = intimacao.prazo ? new Date(intimacao.prazo) : null;
      const hasValidPrazo = prazoDate && !Number.isNaN(prazoDate.getTime());
      const descricaoPartes: string[] = [];

      if (intimacao.nomeOrgao) {
        descricaoPartes.push(`Órgão: ${intimacao.nomeOrgao}`);
      }

      if (intimacao.tipoComunicacao) {
        descricaoPartes.push(`Tipo: ${intimacao.tipoComunicacao}`);
      }

      if (hasValidPrazo) {
        descricaoPartes.push(`Prazo: ${format(prazoDate!, "dd/MM/yyyy", { locale: ptBR })}`);
        params.set("data", prazoDate!.toISOString());
      }

      const tituloReferencia = numero || String(intimacao.id);
      params.set("origem", "intimacao");
      params.set("titulo", `Compromisso da intimação ${tituloReferencia}`);

      if (descricaoPartes.length > 0) {
        params.set("descricao", descricaoPartes.join(" • "));
      }

      if (intimacao.tipoComunicacao) {
        params.set("tipo", intimacao.tipoComunicacao);
      }

      if (numero) {
        params.set("processo", numero);
      } else {
        params.set("intimacao", String(intimacao.id));
      }

      const query = params.toString();
      navigate(query ? `/agenda?${query}` : "/agenda");
    },
    [navigate],
  );

  const handleFiltersChange = <Key extends keyof FiltersState>(key: Key, value: FiltersState[Key]) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
    setPage(1);
  };

  const { total, active, unread, currentMonth, archived, statusDistribution, monthlyDistribution } =
    summary;
  const isBulkProcessing = bulkAction !== null;
  const canMarkAllAsRead = filteredIntimacoes.some((item) => item.nao_lida);
  const canArchiveAll = filteredIntimacoes.some((item) => !item.arquivada);
  const summarySourceText = useMemo(
    () => (summaryTarget ? normalizarTexto(summaryTarget.texto) : ""),
    [summaryTarget],
  );
  const sanitizedOabInput = oabNumber.replace(/\D/g, "");
  const isOabFormValid =
    selectedUserId.trim().length > 0 &&
    sanitizedOabInput.length > 0 &&
    oabUf.trim().length === 2 &&
    (oabSyncFromMode !== "date" || oabSyncFromDate !== null);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-sm text-muted-foreground">
            Consulte as intimações mais recentes da sua empresa e expanda para visualizar os detalhes completos de cada caso.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleOpenOabModal} disabled={isBulkProcessing || loading}>
            <IdCard className="mr-2 h-4 w-4" />
            Gerenciar OABs
          </Button>
          <Button
            variant="secondary"
            onClick={handleMarkAllAsRead}
            disabled={isBulkProcessing || loading || !canMarkAllAsRead}
          >
            {bulkAction === "read" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Marcar todas como lidas
          </Button>
          <Button
            variant="outline"
            onClick={handleArchiveAll}
            disabled={isBulkProcessing || loading || !canArchiveAll}
          >
            {bulkAction === "archive" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Arquivar todas
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading || isBulkProcessing}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-border/60 bg-card/60 backdrop-blur transition-all hover:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de intimações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberFormatter.format(total)}</div>
            <p className="text-xs text-muted-foreground">
              Inclui {numberFormatter.format(archived)} arquivadas
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur transition-all hover:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intimações ativas</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberFormatter.format(active)}</div>
            <p className="text-xs text-muted-foreground">
              Intimações ainda não arquivadas
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur transition-all hover:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Não lidas</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberFormatter.format(unread)}</div>
            <p className="text-xs text-muted-foreground">
              Intimações aguardando leitura
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur transition-all hover:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponíveis neste mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberFormatter.format(currentMonth)}</div>
            <p className="text-xs text-muted-foreground">
              Registradas no mês atual
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur transition-all hover:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OABs monitoradas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monitoredOabsLoading && monitoredOabs.length === 0
                ? "..."
                : numberFormatter.format(monitoredOabs.length)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastradas para monitoramento
            </p>
          </CardContent>
        </Card>
      </div>



      <Card className="border-border/60 bg-card/60">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filtro-processo">Buscar por processo</Label>
              <Input
                id="filtro-processo"
                placeholder="Número do processo"
                value={filters.search}
                onChange={(event) => handleFiltersChange("search", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-periodo">Período</Label>
              <Select
                value={filters.periodo}
                onValueChange={(value) => handleFiltersChange("periodo", value as PeriodFilter)}
              >
                <SelectTrigger id="filtro-periodo">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-situacao">Situação</Label>
              <Select
                value={filters.situacao}
                onValueChange={(value) => handleFiltersChange("situacao", value as SituationFilter)}
              >
                <SelectTrigger id="filtro-situacao">
                  <SelectValue placeholder="Selecione a situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="nao-lidas">Não lidas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="arquivadas">Arquivadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-advogado">Advogado responsável</Label>
              <Select
                value={filters.advogado}
                onValueChange={(value) => handleFiltersChange("advogado", value)}
              >
                <SelectTrigger id="filtro-advogado">
                  <SelectValue placeholder="Selecione o advogado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os advogados</SelectItem>
                  {advogadoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-tribunal">Tribunal</Label>
              <Select
                value={filters.tribunal}
                onValueChange={(value) => handleFiltersChange("tribunal", value)}
              >
                <SelectTrigger id="filtro-tribunal">
                  <SelectValue placeholder="Selecione o tribunal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tribunalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-tipo">Tipo de comunicação</Label>
              <Select
                value={filters.tipo}
                onValueChange={(value) => handleFiltersChange("tipo", value)}
              >
                <SelectTrigger id="filtro-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tipoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && intimacoes.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-dashed border-border/60">
              <CardHeader className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && filteredIntimacoes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          <div className="space-y-4">
            <p>Nenhuma intimação encontrada.</p>
            {canManageOabs ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cadastre uma OAB monitorada para começar a receber avisos assim que novas intimações forem disponibilizadas.
                </p>
                <div className="flex justify-center">
                  <Button onClick={handleOpenOabModal}>Cadastrar OAB</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {paginatedIntimacoes.length > 0 ? (
        <>
          <div className="space-y-3">
            {paginatedIntimacoes.map((intimacao, index) => {
              const itemId = String(intimacao.id ?? index);
              const numeroProcesso =
                typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
              const disponibilizadaEm = formatDateTime(intimacao.data_disponibilizacao);
              const prazoFormatado = formatDateOrText(intimacao.prazo);

              const destinatarios = normalizeDestinatarios(intimacao.destinatarios);
              const destinatariosStr = destinatarios.map(d => d.nome).join(", ");

              const advogados = normalizeDestinatariosAdvogados(intimacao.destinatarios_advogados);
              const advogadosStr = advogados.map(formatAdvogadoLabel).join(", ");

              const isMarking = markingId === String(intimacao.id);
              const isArchiving = archivingId === String(intimacao.id);

              return (
                <IntimacaoCard
                  key={itemId}
                  numeroProcesso={numeroProcesso}
                  tipoComunicacao={intimacao.tipoComunicacao ?? null}
                  orgao={intimacao.nomeOrgao ?? "Órgão não informado"}
                  siglaTribunal={intimacao.siglaTribunal}
                  destinatarios={destinatariosStr}
                  advogados={advogadosStr || "Sem advogados vinculados"}
                  dataDisponibilizacao={disponibilizadaEm ?? "Data não informada"}
                  prazo={prazoFormatado}
                  isUnread={Boolean(intimacao.nao_lida)}
                  isArchived={Boolean(intimacao.arquivada)}
                  onView={() => handleOpenDetails(intimacao)}
                  onMarkAsRead={!intimacao.nao_lida ? undefined : () => handleMarkAsRead(intimacao.id)}
                  onArchive={intimacao.arquivada ? undefined : () => handleArchive(intimacao.id)}
                  onOpenTask={() => handleOpenTask(intimacao)}
                  onAddToAgenda={() => handleAddToAgenda(intimacao)}
                  isMarkingAsRead={isMarking}
                  isArchiving={isArchiving}
                  isLoading={isBulkProcessing}
                />
              );
            })}
          </div>

          <Dialog open={detailsDialogOpen} onOpenChange={handleDetailsDialogChange}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden bg-background p-0 sm:max-w-5xl">
              {detailsTarget
                ? (() => {
                  const current = detailsTarget!;
                  const destinatarios = normalizeDestinatarios(current.destinatarios);
                  const destinatariosAdv = normalizeDestinatariosAdvogados(current.destinatarios_advogados);
                  const prazoFormatado = formatDateOrText(current.prazo);
                  const cancelamentoFormatado = formatDateTime(current.data_cancelamento);
                  const disponibilizadaEm = formatDateTime(current.data_disponibilizacao);
                  const headerDate =
                    formatDateTime(current.data_disponibilizacao) ??
                    formatDateTime(current.created_at) ??
                    formatDateTime(current.updated_at);
                  const textoNormalizado = normalizeRichText(current.texto);
                  const numeroProcesso =
                    typeof current.numero_processo === "string"
                      ? current.numero_processo.trim()
                      : "";
                  const isArchiving = archivingId === String(current.id);
                  const isMarking = markingId === String(current.id);
                  const podeResumir = Boolean(normalizarTexto(current.texto));
                  const summaryInProgress =
                    summaryLoading &&
                    summaryTarget &&
                    String(summaryTarget.id) === String(current.id);

                  const hasPrazo = Boolean(current.prazo);

                  return (
                    <div className="flex h-full flex-col">
                      {/* Header Section */}
                      <div className="flex flex-col gap-4 border-b bg-muted/10 px-6 py-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                              {numeroProcesso ? (
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                                  <Link
                                    to={`/processos/${encodeURIComponent(numeroProcesso)}`}
                                    className="underline-offset-2 hover:underline hover:text-primary transition-colors"
                                  >
                                    {formatProcessNumber(numeroProcesso)}
                                  </Link>
                                </DialogTitle>
                              ) : (
                                <DialogTitle className="text-xl font-bold tracking-tight text-muted-foreground">
                                  Processo não informado
                                </DialogTitle>
                              )}
                              <div className="flex items-center gap-2">
                                {current.nao_lida && <Badge variant="destructive" className="h-5 px-2 text-[10px]">Nova</Badge>}
                                {current.arquivada && <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-muted text-muted-foreground">Arquivada</Badge>}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                {current.siglaTribunal && <span className="font-medium">{current.siglaTribunal}</span>}
                                {current.siglaTribunal && current.nomeOrgao && <span className="text-muted-foreground/40">•</span>}
                                {current.nomeOrgao}
                              </span>
                              {current.tipoComunicacao && (
                                <>
                                  <span className="text-muted-foreground/40">•</span>
                                  <Badge variant="outline" className="h-5 border-primary/20 bg-primary/5 text-primary text-[10px] uppercase">{current.tipoComunicacao}</Badge>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {disponibilizadaEm ? (
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-background border rounded-md px-2.5 py-1 shadow-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {disponibilizadaEm.split(" ")[0]}
                              </div>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground">Data de disponibilização</span>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {disponibilizadaEm && <span>Publicado {disponibilizadaEm}</span>}
                            {headerDate && <span>• Atualizado {headerDate}</span>}
                          </div>

                          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                            {current.nao_lida && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(current.id)}
                                disabled={isMarking || isArchiving || isBulkProcessing}
                                className="h-8 gap-2 text-primary hover:text-primary hover:bg-primary/10"
                              >
                                {isMarking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                                Marcar lida
                              </Button>
                            )}
                            {!current.arquivada && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchive(current.id)}
                                disabled={isArchiving || isMarking || isBulkProcessing}
                                className="h-8 gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                                Arquivar
                              </Button>
                            )}
                            <div className="h-4 w-px bg-border/50 mx-1 hidden sm:block" />
                            <Button variant="outline" size="sm" onClick={() => handleOpenTask(current)} disabled={isBulkProcessing} className="h-8 gap-2 text-muted-foreground">
                              <ListChecks className="h-3.5 w-3.5" />
                              Tarefa
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleAddToAgenda(current)} disabled={isBulkProcessing} className="h-8 gap-2 text-muted-foreground">
                              <CalendarPlus className="h-3.5 w-3.5" />
                              Agenda
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Content Scrollable Area */}
                      <div className="flex-1 overflow-y-auto lg:overflow-hidden bg-muted/5 p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-full">

                          {/* Left Column: Info & Metadata */}
                          <div className="lg:col-span-4 flex flex-col gap-6 lg:overflow-y-auto lg:h-full lg:pr-2 custom-scrollbar">
                            {/* Prazo Alert */}
                            {hasPrazo && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                                    <Clock className="h-5 w-5" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Prazo Legal</p>
                                    <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{prazoFormatado}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Info Card */}
                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                              <div className="px-4 py-3 border-b bg-muted/40">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <IdCard className="h-4 w-4 text-muted-foreground" />
                                  Detalhes
                                </h3>
                              </div>
                              <div className="p-4 space-y-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground uppercase">Classe Judicial</p>
                                  <p className="text-sm font-medium">
                                    {current.nomeclasse || "Não informada"}
                                    {current.codigoclasse && <span className="ml-1 text-muted-foreground text-xs">({current.codigoclasse})</span>}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase">Meio</p>
                                    <p className="text-sm">{current.meio === "D" ? "DJEN" : "Portal"}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase">Documento</p>
                                    <p className="text-sm">{current.tipodocumento || "-"}</p>
                                  </div>
                                </div>
                                {(current.motivo_cancelamento || current.data_cancelamento) && (
                                  <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-1">
                                    <p className="text-xs font-bold text-destructive flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Cancelamento
                                    </p>
                                    <p className="text-xs text-muted-foreground">{current.motivo_cancelamento}</p>
                                    <p className="text-xs text-muted-foreground">{cancelamentoFormatado}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Partes Card */}
                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                              <div className="px-4 py-3 border-b bg-muted/40">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  Partes
                                </h3>
                              </div>
                              <div className="p-4">
                                {destinatarios.length > 0 ? (
                                  <ul className="space-y-3">
                                    {destinatarios.map((dest, i) => (
                                      <li key={i} className="flex gap-3 text-sm">
                                        <div className="h-2 w-2 mt-1.5 rounded-full bg-primary/40 shrink-0" />
                                        <div className="space-y-0.5">
                                          <p className="font-medium leading-snug">{dest.nome}</p>
                                          {dest.polo && (
                                            <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                              {dest.polo === "P" ? "Polo Passivo" : "Polo Ativo"}
                                            </span>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Nenhuma parte identificada</p>
                                )}
                              </div>
                            </div>

                            {/* Advogados Card */}
                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                              <div className="px-4 py-3 border-b bg-muted/40">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <Scale className="h-4 w-4 text-muted-foreground" />
                                  Advogados
                                </h3>
                              </div>
                              <div className="p-4">
                                {destinatariosAdv.length > 0 ? (
                                  <ul className="space-y-3">
                                    {destinatariosAdv.map((adv, i) => (
                                      <li key={i} className="flex gap-3 text-sm">
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                          <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <p className="font-medium leading-snug">{adv.nome}</p>
                                          {(adv.ufOab || adv.numeroOab) && (
                                            <p className="text-xs text-muted-foreground">
                                              OAB {adv.ufOab}{adv.numeroOab ? ` ${adv.numeroOab}` : ""}
                                            </p>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Nenhum advogado vinculado</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Content */}
                          <div className="lg:col-span-8 flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
                            <div className="rounded-xl border bg-card shadow-sm flex-1 flex flex-col ring-1 ring-border/50 lg:overflow-hidden">
                              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm rounded-t-xl">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <h3 className="font-semibold text-sm text-foreground">Teor da Comunicação</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs bg-primary/90 hover:bg-primary shadow-sm"
                                    onClick={() => handleOpenSummary(current)}
                                    disabled={!podeResumir || summaryLoading || isBulkProcessing}
                                  >
                                    {summaryInProgress ? (
                                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="mr-1.5 h-3 w-3" />
                                    )}
                                    Resumir com IA
                                  </Button>
                                  {current.link && (
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" asChild>
                                      <a href={current.link} target="_blank" rel="noopener noreferrer" title="Abrir link original">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="relative flex-1 bg-white dark:bg-zinc-950 rounded-b-xl lg:rounded-none">
                                <div className="p-6 lg:absolute lg:inset-0 lg:overflow-y-auto">
                                  {textoNormalizado ? (
                                    textoNormalizado.type === "html" ? (
                                      <div
                                        className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-em:text-foreground/90 prose-a:text-primary prose-a:no-underline hover:prose-a:underline dark:prose-invert"
                                        dangerouslySetInnerHTML={{ __html: textoNormalizado.value }}
                                      />
                                    ) : (
                                      <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-foreground/90">
                                        {textoNormalizado.value}
                                      </div>
                                    )
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-50">
                                      <FileText className="h-10 w-10" />
                                      <p>Teor não disponível</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
                : null}
            </DialogContent>
          </Dialog>

          {totalPages > 1 ? (
            <Pagination className="justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(current - 1, 1));
                    }}
                    aria-disabled={page === 1}
                    className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    <span>Anterior</span>
                  </PaginationLink>
                </PaginationItem>
                {paginationItems.map((item, itemIndex) =>
                  typeof item === "number" ? (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        size="default"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(item);
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
                      setPage((current) => Math.min(current + 1, totalPages));
                    }}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
                  >
                    <span>Próxima</span>
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      ) : null}
      <Dialog open={oabSyncingProcesses}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Sincronizando processos</p>
            <p className="text-xs text-muted-foreground">
              Aguarde enquanto sincronizamos os processos vinculados ao registro.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={oabModalOpen} onOpenChange={handleOabModalChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <DialogHeader className="border-b border-border/40 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-8 ring-primary/5">
                <Scale className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl">Gerenciar OABs Monitoradas</DialogTitle>
                <DialogDescription className="text-base">
                  Acompanhe automaticamente as intimações de OABs vinculadas.
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
                {monitoredOabs.length > 0 && (
                  <Badge variant="secondary" className="rounded-full px-2.5">
                    {monitoredOabs.length}
                  </Badge>
                )}
              </div>

              {monitoredOabsLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando monitoramentos...
                </div>
              ) : monitoredOabsError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {monitoredOabsError}
                </div>
              ) : monitoredOabs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center">
                  <p className="text-sm text-primary/80 font-medium">
                    Nenhuma OAB sendo monitorada no momento.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {monitoredOabs.map((item) => {
                    const userOab = item.usuarioOabNumero
                      ? formatMonitoredOabDisplay(item.usuarioOabNumero, item.usuarioOabUf ?? "")
                      : null;

                    return (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between gap-4 rounded-xl border border-border/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/20 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="font-mono text-xs font-semibold border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
                              {formatMonitoredOabDisplay(item.number, item.uf)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                void handleRemoveMonitoredOab(item.id);
                              }}
                              disabled={removingOabId === item.id}
                            >
                              {removingOabId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X size={16} />
                              )}
                              <span className="sr-only">Remover</span>
                            </Button>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium leading-none text-foreground truncate">
                              {item.usuarioNome ?? "Usuário não identificado"}
                            </p>
                            {userOab ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {userOab}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px]">
                            <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              <Calendar className="h-3 w-3" />
                              Desde {formatSyncFromValue(item.syncFrom)}
                            </span>
                            <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                              <Clock className="h-3 w-3" />
                              {formatDiasSemanaDescription(item.diasSemana)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                    value={selectedUserId}
                    onValueChange={handleSelectCompanyUser}
                    disabled={companyUsersLoading || companyUsers.length === 0}
                  >
                    <SelectTrigger className="h-10 bg-background border-blue-200/50 dark:border-blue-900/50 focus:ring-blue-500/20">
                      <SelectValue
                        placeholder={
                          companyUsersLoading
                            ? "Carregando usuários..."
                            : companyUsersError ?? "Selecione o responsável"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {companyUsers.map((user) => {
                        const userOab = user.oabNumber
                          ? formatMonitoredOabDisplay(user.oabNumber, user.oabUf ?? "")
                          : null;

                        return (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                            {userOab ? ` (${userOab})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {companyUsersError ? (
                    <p className="text-sm text-destructive">{companyUsersError}</p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Sincronização Automática
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Escolha os dias da semana para verificar novas intimações.
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
                      <RadioGroupItem value="all" id="intimacoes-sync-from-all" />
                      <Label htmlFor="intimacoes-sync-from-all" className="flex-1 cursor-pointer font-normal text-sm">
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
                        <RadioGroupItem value="date" id="intimacoes-sync-from-date" />
                        <Label htmlFor="intimacoes-sync-from-date" className="flex-1 cursor-pointer font-normal text-sm">
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
              disabled={oabSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleRegisterOab();
              }}
              disabled={!isOabFormValid || oabSubmitting || !canSubmitOab}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {oabSubmitting ? (
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
      <Dialog open={summaryDialogOpen} onOpenChange={handleSummaryDialogChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <DialogTitle>Resumo da intimação</DialogTitle>
            {summaryTarget ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (summaryTarget) {
                    startSummaryGeneration(summaryTarget);
                  }
                }}
                disabled={summaryLoading}
                className="inline-flex items-center gap-2"
              >
                {summaryLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resumindo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar novamente
                  </>
                )}
              </Button>
            ) : null}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                Processo: {summaryTarget?.numero_processo ? summaryTarget.numero_processo : "Não informado"}
              </div>
              {summaryTarget?.siglaTribunal || summaryTarget?.nomeOrgao ? (
                <div>
                  {[summaryTarget?.siglaTribunal, summaryTarget?.nomeOrgao].filter(Boolean).join(" • ")}
                </div>
              ) : null}
              {summaryTarget ? (
                <div>
                  Disponibilizada em: {formatDateTime(summaryTarget.data_disponibilizacao) ?? "Data não informada"}
                </div>
              ) : null}
            </div>
            {summaryLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando resumo com IA...
              </div>
            ) : null}
            {summaryError ? <p className="text-sm text-destructive">{summaryError}</p> : null}
            {summaryContent ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-primary">Resumo com IA</h3>
                <SafeMarkdown content={summaryContent} className="text-primary" />
              </div>
            ) : null}
            {summarySourceText ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Conteúdo utilizado
                </h3>
                <div className="rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {summarySourceText}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
