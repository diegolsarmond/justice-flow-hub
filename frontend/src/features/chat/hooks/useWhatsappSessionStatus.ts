import { useMemo } from "react";
import { useQuery, type QueryObserverResult } from "@tanstack/react-query";
import { fetchUazQrCode, type UazQrCodeResponse } from "../services/deviceLinkingApi";
import {
  useSessionStatusStore,
  type SessionStatusEntry,
} from "../state/sessionStatusStore";

type StatusTone = "success" | "warning" | "danger";

export type WhatsappConnectionState =
  | "connected"
  | "connecting"
  | "pending"
  | "disconnected"
  | "unconfigured"
  | "unavailable"
  | "error";

export interface WhatsappSessionStatusResult {
  data: UazQrCodeResponse | undefined;
  rawStatus: string;
  connectionState: WhatsappConnectionState;
  statusLabel: string;
  tone: StatusTone;
  isConnected: boolean;
  isAwaitingProvisioning: boolean;
  isErrorState: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<QueryObserverResult<UazQrCodeResponse, Error>>;
  dataUpdatedAt: number;
  sessionEntry?: SessionStatusEntry;
}

const statusLabels: Record<WhatsappConnectionState, string> = {
  connected: "WhatsApp conectado",
  connecting: "Sincronizando",
  pending: "Aguardando leitura",
  disconnected: "Reconexão necessária",
  unconfigured: "Integração não configurada",
  unavailable: "Instância indisponível",
  error: "Erro na integração",
};

const toneByState: Record<WhatsappConnectionState, StatusTone> = {
  connected: "success",
  connecting: "warning",
  pending: "warning",
  unconfigured: "warning",
  unavailable: "warning",
  disconnected: "danger",
  error: "danger",
};

const stateSeverity: Record<WhatsappConnectionState, number> = {
  error: 5,
  disconnected: 4,
  unavailable: 3,
  unconfigured: 2,
  connecting: 1,
  connected: 1,
  pending: 0,
};

const normalizeStatus = (value?: string | null) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : "pending";

const deriveStateFromQr = (status: string): WhatsappConnectionState => {
  switch (status) {
    case "connected":
    case "authenticated":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "failed":
    case "error":
      return "error";
    case "unconfigured":
      return "unconfigured";
    case "unavailable":
      return "unavailable";
    default:
      return "pending";
  }
};

const pickLatestSessionEntry = (entries: SessionStatusEntry[]) => {
  if (entries.length === 0) {
    return undefined;
  }
  return entries.reduce<SessionStatusEntry | undefined>((latest, entry) => {
    if (!latest) {
      return entry;
    }
    return latest.updatedAt > entry.updatedAt ? latest : entry;
  }, undefined);
};

export const useWhatsappSessionStatus = (): WhatsappSessionStatusResult => {
  const sessionStore = useSessionStatusStore();
  const latestSessionEntry = useMemo(
    () => pickLatestSessionEntry(Object.values(sessionStore.sessions)),
    [sessionStore.sessions],
  );

  const qrCodeQuery = useQuery<UazQrCodeResponse>({
    queryKey: ["device-link", "uaz", "qr"],
    queryFn: fetchUazQrCode,
    refetchInterval: (data) => {
      const normalized = normalizeStatus(data?.status ?? null);
      if (
        normalized === "connected" ||
        normalized === "authenticated" ||
        normalized === "unconfigured" ||
        normalized === "unavailable"
      ) {
        return false;
      }
      return 30000;
    },
  });

  const rawStatus = normalizeStatus(qrCodeQuery.data?.status ?? null);
  const qrState = deriveStateFromQr(rawStatus);

  let connectionState: WhatsappConnectionState = qrState;

  const sessionState = latestSessionEntry?.status;
  if (sessionState) {
    const mappedState: WhatsappConnectionState =
      sessionState === "connected"
        ? "connected"
        : sessionState === "connecting"
          ? "connecting"
          : "disconnected";
    if (stateSeverity[mappedState] > stateSeverity[connectionState]) {
      connectionState = mappedState;
    }
  }

  const isAwaitingProvisioning = qrState === "unconfigured" || qrState === "unavailable";
  const isConnected = connectionState === "connected";
  const isErrorState = connectionState === "disconnected" || connectionState === "error";

  return {
    data: qrCodeQuery.data,
    rawStatus,
    connectionState,
    statusLabel: statusLabels[connectionState],
    tone: toneByState[connectionState],
    isConnected,
    isAwaitingProvisioning,
    isErrorState,
    isLoading: qrCodeQuery.isLoading,
    isFetching: qrCodeQuery.isFetching,
    isError: qrCodeQuery.isError,
    refetch: qrCodeQuery.refetch,
    dataUpdatedAt: qrCodeQuery.dataUpdatedAt,
    sessionEntry: latestSessionEntry,
  };
};
