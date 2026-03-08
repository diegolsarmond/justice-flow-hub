import { getApiUrl, joinUrl } from './api';

export type AsaasPaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';

export interface CreateAsaasChargePayload {
  customerId: string;
  paymentMethod: AsaasPaymentMethod;
  installmentCount?: number;
  dueDate?: string;
  cardToken?: string;
  cardMetadata?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
}

export interface AsaasCharge {
  id?: string;
  flowId?: number;
  paymentMethod: AsaasPaymentMethod;
  value?: number;
  status?: string;
  dueDate?: string;
  pixPayload?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  cardAuthorizationCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  raw?: unknown;
}

export interface AsaasChargeStatus {
  status: string;
  description?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CardTokenPayload {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  document: string;
  email: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
}

export interface CardTokenResponse {
  token: string;
  brand?: string;
  last4Digits?: string;
  raw?: unknown;
}

export interface RefundAsaasChargePayload {
  value?: number;
  description?: string;
  externalReference?: string;
  keepCustomerFee?: boolean;
}

export interface ReceiveAsaasChargeInCashPayload {
  paymentDate: string;
  value: number;
  notifyCustomer: boolean;
}

export interface ReceiveAsaasChargeInCashResult {
  flow: Flow;
  charge: AsaasCharge;
}

export interface RefundAsaasChargeResult {
  flow: Flow;
  charge: AsaasCharge;
  refund: unknown;
}

export interface RefreshAsaasChargeStatusResult {
  charge: AsaasCharge | null;
  statuses: AsaasChargeStatus[];
}

export interface Flow {
  id: number | string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  vencimento: string;
  pagamento?: string | null;
  valor: number;
  status: 'pendente' | 'pago' | 'vencido' | 'estornado';
  cliente_id?: string | null;
  fornecedor_id?: string | null;
  origin?: string | null;
}

const FLOWS_ENDPOINT = getApiUrl('financial/flows');
const DEFAULT_FLOW_FETCH_LIMIT = 500;

function extractFlowCollection(payload: unknown): Flow[] | null {
  if (Array.isArray(payload)) {
    return payload as Flow[];
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray((payload as { [key: string]: unknown }).items)) {
      return (payload as { [key: string]: unknown }).items as Flow[];
    }

    if (Array.isArray((payload as { [key: string]: unknown }).data)) {
      return (payload as { [key: string]: unknown }).data as Flow[];
    }

    if (Array.isArray((payload as { [key: string]: unknown }).results)) {
      return (payload as { [key: string]: unknown }).results as Flow[];
    }
  }

  return null;
}

type FlowPageResult = { items: Flow[]; payload: unknown };

const PAGINATION_TOTAL_KEYS = ['total', 'count', 'totalCount'] as const;
const PAGINATION_LIMIT_KEYS = ['limit', 'pageSize', 'perPage'] as const;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return undefined;
};

const extractFirstAvailableString = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): string | undefined => {
  for (const source of sources) {
    if (!source) continue;

    for (const key of keys) {
      if (!(key in source)) continue;

      const value = normalizeStringValue(source[key]);
      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
};

const extractFirstAvailableNumber = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null => {
  for (const source of sources) {
    if (!source) continue;

    for (const key of keys) {
      if (!(key in source)) continue;

      const candidate = parseNumber(source[key]);
      if (candidate !== null) {
        return candidate;
      }
    }
  }

  return null;
};

const extractPaginationMeta = (payload: unknown): { total: number | null; limit: number | null } => {
  if (!payload || typeof payload !== 'object') {
    return { total: null, limit: null };
  }

  const record = payload as Record<string, unknown>;
  const nestedCandidates = [
    record,
    record.meta as Record<string, unknown> | undefined,
    record.pagination as Record<string, unknown> | undefined,
  ];

  const total = extractFirstAvailableNumber(nestedCandidates, PAGINATION_TOTAL_KEYS);
  const limit = extractFirstAvailableNumber(nestedCandidates, PAGINATION_LIMIT_KEYS);

  return { total, limit };
};

const buildFlowsUrl = (limit: number, page: number): string => {
  const url = new URL(FLOWS_ENDPOINT);

  if (Number.isFinite(limit) && limit > 0) {
    url.searchParams.set('limit', String(Math.floor(limit)));
  } else {
    url.searchParams.delete('limit');
  }

  if (Number.isFinite(page) && page > 0) {
    url.searchParams.set('page', String(Math.floor(page)));
  } else {
    url.searchParams.delete('page');
  }

  return url.toString();
};

const requestFlowsPage = async (limit: number, page: number): Promise<FlowPageResult> => {
  const response = await fetch(buildFlowsUrl(limit, page));

  if (response.status === 404 || response.status === 503) {
    return { items: [], payload: { data: [], total: 0, limit, page } };
  }

  await ensureOkResponse(response);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('Não foi possível interpretar a resposta do servidor.');
  }

  const collection = extractFlowCollection(payload);

  if (!collection) {
    throw new Error('Resposta inválida do servidor ao carregar os lançamentos financeiros.');
  }

  return { items: collection, payload };
};

export async function fetchFlows(): Promise<Flow[]> {
  const initialPage = await requestFlowsPage(DEFAULT_FLOW_FETCH_LIMIT, 1);

  const flows: Flow[] = [...initialPage.items];
  const { total, limit } = extractPaginationMeta(initialPage.payload);

  const effectiveLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_FLOW_FETCH_LIMIT;
  const expectedTotal = typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : null;

  let lastPageSize = flows.length;
  let currentPage = 1;

  while (true) {
    const hasMoreByTotal = expectedTotal !== null && flows.length < expectedTotal;
    const hasMoreByPageSize = expectedTotal === null && lastPageSize >= effectiveLimit;

    if (!hasMoreByTotal && !hasMoreByPageSize) {
      break;
    }

    currentPage += 1;
    const nextPage = await requestFlowsPage(effectiveLimit, currentPage);

    if (nextPage.items.length === 0) {
      break;
    }

    flows.push(...nextPage.items);
    lastPageSize = nextPage.items.length;
  }

  return flows;
}

export type CreateFlowPayload = {
  tipo: Flow['tipo'];
  descricao: string;
  valor: number;
  vencimento: string;
  clienteId?: string | number | null;
  fornecedorId?: string | number | null;
};

export async function createFlow(flow: CreateFlowPayload): Promise<Flow> {
  const res = await fetch(FLOWS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  const data = await res.json();
  return data.flow;
}

const FLOW_ID_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLOW_ID_INTEGER_REGEX = /^-?\d+$/;

export async function ensureOkResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === 'object') {
        errorMessage = (errorBody as { error?: string }).error ||
          (errorBody as { message?: string }).message ||
          JSON.stringify(errorBody);
      }
    } catch {
      // Ignore parsing error, keep status message
    }
    throw new Error(errorMessage);
  }
  return response;
}

export function normalizeFlowId(id: Flow['id']): string | null {
  if (typeof id === 'number') {
    return id.toString();
  }

  if (typeof id !== 'string') {
    return null;
  }

  const trimmed = id.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  return null;
}

export async function createAsaasCharge(
  flowId: number | string,
  payload: CreateAsaasChargePayload,
): Promise<AsaasCharge> {
  const endpoint = getChargeEndpoint(flowId);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  await ensureOkResponse(response);
  const data = await response.json();
  const charge = normalizeCharge(data);
  if (!charge) {
    throw new Error('Resposta inesperada ao criar cobrança');
  }
  return charge;
}

export async function settleFlow(id: Flow['id'], pagamentoData: string): Promise<Flow> {
  const normalizedId = normalizeFlowId(id);

  if (!normalizedId) {
    throw new Error('Este lançamento não pode ser marcado como pago manualmente.');
  }

  const res = await fetch(joinUrl(FLOWS_ENDPOINT, `${normalizedId}/settle`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagamentoData }),
  });

  await ensureOkResponse(res);
  const data = await res.json();
  return data.flow;
}

function extractData<T>(payload: unknown, key: string): T | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return (value as T) ?? null;
  }
  return null;
}

function normalizePaymentMethod(method: unknown): AsaasPaymentMethod {
  const normalized = String(method ?? '').toUpperCase();
  if (normalized === 'PIX' || normalized === 'BOLETO' || normalized === 'CREDIT_CARD' || normalized === 'DEBIT_CARD') {
    return normalized;
  }
  if (normalized === 'CREDITCARD') {
    return 'CREDIT_CARD';
  }
  if (normalized === 'DEBITCARD' || normalized === 'DEBIT' || normalized === 'DEBITO' || normalized === 'DÉBITO') {
    return 'DEBIT_CARD';
  }
  if (normalized === 'BOLETO_BANCARIO' || normalized === 'BANK_SLIP') {
    return 'BOLETO';
  }
  return 'PIX';
}

export function normalizeCharge(raw: unknown): AsaasCharge | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const charge = (raw as { [key: string]: unknown }).charge ?? raw;
  if (!charge || typeof charge !== 'object') {
    return null;
  }

  const normalized: AsaasCharge = {
    id:
      (charge as { [key: string]: unknown }).id?.toString?.() ??
      (charge as { [key: string]: unknown }).chargeId?.toString?.() ??
      (charge as { [key: string]: unknown }).charge_id?.toString?.(),
    flowId:
      typeof (charge as { [key: string]: unknown }).flowId === 'number'
        ? ((charge as { [key: string]: unknown }).flowId as number)
        : undefined,
    paymentMethod: normalizePaymentMethod(
      (charge as { [key: string]: unknown }).paymentMethod ??
      (charge as { [key: string]: unknown }).payment_method ??
      (charge as { [key: string]: unknown }).billingType,
    ),
    value: Number((charge as { [key: string]: unknown }).value ?? (charge as { [key: string]: unknown }).amount),
    status: (charge as { [key: string]: unknown }).status as string | undefined,
    dueDate: (charge as { [key: string]: unknown }).dueDate as string | undefined,
    pixPayload:
      (charge as { [key: string]: unknown }).pixPayload as string | undefined ??
      (charge as { [key: string]: unknown }).payload as string | undefined ??
      (charge as { [key: string]: unknown }).copyPasteCode as string | undefined,
    pixQrCode:
      (charge as { [key: string]: unknown }).pixQrCode as string | undefined ??
      (charge as { [key: string]: unknown }).encodedImage as string | undefined ??
      (charge as { [key: string]: unknown }).qrCode as string | undefined,
    boletoUrl:
      (charge as { [key: string]: unknown }).bankSlipUrl as string | undefined ??
      (charge as { [key: string]: unknown }).boletoUrl as string | undefined ??
      (charge as { [key: string]: unknown }).invoiceUrl as string | undefined,
    boletoBarcode:
      (charge as { [key: string]: unknown }).identificationField as string | undefined ??
      (charge as { [key: string]: unknown }).digitableLine as string | undefined ??
      (charge as { [key: string]: unknown }).barCode as string | undefined,
    cardAuthorizationCode:
      (charge as { [key: string]: unknown }).authorizationCode as string | undefined ??
      (charge as { [key: string]: unknown }).nsu as string | undefined,
    cardBrand: extractFirstAvailableString(
      [
        charge as Record<string, unknown>,
        (charge as { [key: string]: unknown }).creditCard as Record<string, unknown> | undefined,
        (charge as { [key: string]: unknown }).card as Record<string, unknown> | undefined,
      ],
      [
        'cardBrand',
        'card_brand',
        'creditCardBrand',
        'brand',
        'creditCardBrandName',
      ],
    ),
    cardLast4: extractFirstAvailableString(
      [
        charge as Record<string, unknown>,
        (charge as { [key: string]: unknown }).creditCard as Record<string, unknown> | undefined,
        (charge as { [key: string]: unknown }).card as Record<string, unknown> | undefined,
      ],
      [
        'cardLast4',
        'card_last4',
        'cardLastDigits',
        'card_last_digits',
        'last4Digits',
        'lastDigits',
      ],
    ),
    raw: charge,
  };

  return normalized;
}

function normalizeChargeStatuses(payload: unknown): AsaasChargeStatus[] {
  if (!payload) return [];
  const collection = extractData<unknown[]>(payload, 'statuses') ?? extractData<unknown[]>(payload, 'items');
  const entries = Array.isArray(collection) ? collection : Array.isArray(payload) ? payload : [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const statusValue =
        (entry as { [key: string]: unknown }).status ??
        (entry as { [key: string]: unknown }).currentStatus ??
        (entry as { [key: string]: unknown }).code;
      if (typeof statusValue !== 'string') return null;
      return {
        status: statusValue,
        description: (entry as { [key: string]: unknown }).description as string | undefined,
        updatedAt: (entry as { [key: string]: unknown }).updatedAt as string | undefined,
        metadata: entry as Record<string, unknown>,
      } as AsaasChargeStatus;
    })
    .filter((status): status is AsaasChargeStatus => Boolean(status));
}

function getChargeEndpoint(flowId: number | string): string {
  return joinUrl(FLOWS_ENDPOINT, `${flowId}/asaas/charges`);
}

export async function fetchChargeDetails(flowId: number | string): Promise<AsaasCharge | null> {
  const endpoint = getChargeEndpoint(flowId);
  const response = await fetch(endpoint, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  await ensureOkResponse(response);
  const data = await response.json();
  return normalizeCharge(data);
}

export async function listChargeStatus(flowId: number | string): Promise<AsaasChargeStatus[]> {
  const endpoint = joinUrl(getChargeEndpoint(flowId), 'status');
  const response = await fetch(endpoint, { method: 'GET' });
  if (response.status === 404) {
    return [];
  }
  await ensureOkResponse(response);
  const payload = await response.json();
  return normalizeChargeStatuses(payload);
}

export async function resendAsaasCharge(flowId: number | string): Promise<AsaasCharge | null> {
  const endpoint = joinUrl(getChargeEndpoint(flowId), 'resend');
  const response = await fetch(endpoint, { method: 'POST' });

  await ensureOkResponse(response);

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();
  const charge = normalizeCharge(payload);
  if (!charge) {
    throw new Error('Resposta inesperada ao reenviar a cobrança');
  }

  return charge;
}

export async function refreshAsaasChargeStatus(
  flowId: number | string,
): Promise<RefreshAsaasChargeStatusResult> {
  const syncEndpoint = joinUrl(getChargeEndpoint(flowId), 'sync');
  const syncResponse = await fetch(syncEndpoint, { method: 'POST' });
  await ensureOkResponse(syncResponse);

  const statuses = await listChargeStatus(flowId);
  const charge = await fetchChargeDetails(flowId);
  return { charge, statuses } satisfies RefreshAsaasChargeStatusResult;
}

export async function refundAsaasCharge(
  flowId: number | string,
  payload?: RefundAsaasChargePayload,
): Promise<RefundAsaasChargeResult> {
  const endpoint = joinUrl(getChargeEndpoint(flowId), 'refund');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

  await ensureOkResponse(response);
  const data = await response.json();
  const normalizedCharge = normalizeCharge((data as { [key: string]: unknown }).charge);
  if (!normalizedCharge) {
    throw new Error('Resposta inesperada ao estornar cobrança');
  }

  return {
    flow: (data as { [key: string]: unknown }).flow as Flow,
    charge: normalizedCharge,
    refund: (data as { [key: string]: unknown }).refund,
  } satisfies RefundAsaasChargeResult;
}

export async function receiveAsaasChargeInCash(
  flowId: number | string,
  payload: ReceiveAsaasChargeInCashPayload,
): Promise<ReceiveAsaasChargeInCashResult> {
  const endpoint = joinUrl(getChargeEndpoint(flowId), 'receive-in-cash');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  await ensureOkResponse(response);
  const data = await response.json();
  const normalizedCharge = normalizeCharge((data as { [key: string]: unknown }).charge);
  if (!normalizedCharge) {
    throw new Error('Resposta inesperada ao informar recebimento em dinheiro');
  }

  return {
    flow: (data as { [key: string]: unknown }).flow as Flow,
    charge: normalizedCharge,
  } satisfies ReceiveAsaasChargeInCashResult;
}

export async function tokenizeCard(payload: CardTokenPayload): Promise<CardTokenResponse> {
  const endpoint = getApiUrl('asaas/tokenize-card');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await ensureOkResponse(response);
  const data = await response.json();
  const token =
    (data as { [key: string]: unknown }).token ??
    (data as { [key: string]: unknown }).cardToken ??
    (data as { [key: string]: unknown }).id;
  if (!token || typeof token !== 'string') {
    throw new Error('Token do cartão não encontrado na resposta');
  }

  return {
    token,
    brand: (data as { [key: string]: unknown }).brand as string | undefined,
    last4Digits: (data as { [key: string]: unknown }).last4Digits as string | undefined,
    raw: data,
  } satisfies CardTokenResponse;
}

export interface CustomerSyncStatus {
  status: string;
  lastSyncedAt?: string;
  needsSync?: boolean;
  message?: string;
  customerId?: string;
  raw?: unknown;
}

function normalizeCustomerStatus(payload: unknown): CustomerSyncStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const statusValue =
    (payload as { [key: string]: unknown }).status ??
    (payload as { [key: string]: unknown }).syncStatus ??
    (payload as { [key: string]: unknown }).code;

  if (typeof statusValue !== 'string') {
    return null;
  }

  return {
    status: statusValue,
    lastSyncedAt: (payload as { [key: string]: unknown }).lastSyncedAt as string | undefined,
    needsSync: Boolean((payload as { [key: string]: unknown }).needsSync ?? false),
    message: (payload as { [key: string]: unknown }).message as string | undefined,
    customerId: (payload as { [key: string]: unknown }).customerId as string | undefined,
    raw: payload,
  } satisfies CustomerSyncStatus;
}

export async function fetchCustomerSyncStatus(customerId: string): Promise<CustomerSyncStatus | null> {
  const endpoint = getApiUrl(`asaas/customers/status?customerId=${encodeURIComponent(customerId)}`);
  const response = await fetch(endpoint, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  await ensureOkResponse(response);
  const data = await response.json();
  const directStatus = normalizeCustomerStatus(data);
  if (directStatus) {
    return directStatus;
  }

  const statusFromData = extractData<unknown>(data, 'status');
  return normalizeCustomerStatus(statusFromData);
}

export async function syncCustomerNow(customerId: string): Promise<CustomerSyncStatus | null> {
  const endpoint = getApiUrl('asaas/customers/sync');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  await ensureOkResponse(response);
  const data = await response.json();
  const status = normalizeCustomerStatus(data);
  if (status) {
    return status;
  }
  const nested = extractData<unknown>(data, 'status');
  return normalizeCustomerStatus(nested);
}

export interface AsaasSyncResult {
  success: boolean;
  message: string;
  result: {
    totalCharges: number;
    paymentsRetrieved: number;
    chargesUpdated: number;
    flowsUpdated: number;
    fetchedStatuses: string[];
  } | null;
}

export async function syncAsaasCharges(): Promise<AsaasSyncResult> {
  const endpoint = getApiUrl('financial/asaas/sync');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  await ensureOkResponse(response);
  const data = await response.json();

  return {
    success: Boolean((data as { [key: string]: unknown }).success),
    message: String((data as { [key: string]: unknown }).message ?? ''),
    result: (data as { [key: string]: unknown }).result as AsaasSyncResult['result'],
  };
}
