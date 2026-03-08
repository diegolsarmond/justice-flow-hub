import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { sanitizeModuleList } from "@/features/auth/moduleUtils";
import { getApiUrl } from "@/lib/api";

export interface PlanInfo {
  id: number | null;
  nome: string | null;
  modules: string[];
  limits: {
    users: number | null;
    clients: number | null;
    processes: number | null;
    proposals: number | null;
    oabs: number | null;
  };
}

interface PlanContextValue {
  plan: PlanInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<PlanInfo | null>;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

type ApiRecord = Record<string, unknown>;

const extractRows = (input: unknown): ApiRecord[] => {
  if (Array.isArray(input)) {
    return input.filter((item): item is ApiRecord =>
      item !== null && typeof item === "object",
    );
  }

  if (input && typeof input === "object") {
    const data = (input as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data.filter((item): item is ApiRecord =>
        item !== null && typeof item === "object",
      );
    }

    const rows = (input as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows.filter((item): item is ApiRecord =>
        item !== null && typeof item === "object",
      );
    }
  }

  return [];
};

const extractRecord = (input: unknown): ApiRecord | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (Array.isArray(input)) {
    return input.find((item): item is ApiRecord => item !== null && typeof item === "object") ?? null;
  }

  const rows = (input as { rows?: unknown }).rows;
  if (Array.isArray(rows)) {
    return rows.find((item): item is ApiRecord => item !== null && typeof item === "object") ?? null;
  }

  return input as ApiRecord;
};

const toInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return Number.isNaN(normalized) ? null : normalized;
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

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractModulesValue = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(
    async (signal?: AbortSignal): Promise<PlanInfo | null> => {
      if (!isAuthenticated || user?.empresa_id == null) {
        setPlan(null);
        setError(null);
        setIsLoading(false);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [planosRes, empresaRes] = await Promise.all([
          fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal,
          }),
          fetch(getApiUrl(`empresas/${user.empresa_id}`), {
            headers: { Accept: "application/json" },
            signal,
          }),
        ]);

        if (!planosRes.ok) {
          throw new Error(`Falha ao carregar planos (HTTP ${planosRes.status})`);
        }

        if (!empresaRes.ok) {
          throw new Error(
            `Falha ao carregar empresa atual (HTTP ${empresaRes.status})`,
          );
        }

        const [planosJson, empresaJson] = await Promise.all([
          planosRes.json(),
          empresaRes.json(),
        ]);

        if (signal?.aborted) {
          return null;
        }

        const planos = extractRows(planosJson).map((row) => {
          const id = toInteger(row.id);
          const nome = normalizeText(row.nome);
          const rawModules = extractModulesValue(row.modulos ?? row.modules);
          const modules = sanitizeModuleList(rawModules);

          const limits = {
            users: toInteger(row.limite_usuarios ?? row.limiteUsuarios ?? row.usersLimit),
            clients: toInteger(row.limite_clientes ?? row.limiteClientes ?? row.clientsLimit),
            processes: toInteger(row.limite_processos ?? row.limiteProcessos ?? row.processesLimit),
            proposals: toInteger(row.limite_propostas ?? row.limitePropostas ?? row.proposalsLimit),
            oabs: toInteger(row.limite_oabs ?? row.limiteOabs ?? row.oabsLimit ?? row.limite_oabs_monitoradas ?? row.limiteOabsMonitoradas),
          };

          return {
            id,
            nome,
            modules,
            limits,
          } satisfies PlanInfo;
        });

        const empresaRecord = extractRecord(empresaJson);
        const planIdCandidates: number[] = [];
        const rawPlanId = empresaRecord?.plano_id ?? empresaRecord?.plano;
        const parsedPlanId = toInteger(rawPlanId);
        if (parsedPlanId !== null) {
          planIdCandidates.push(parsedPlanId);
        }

        const planNameCandidate = normalizeText(empresaRecord?.plano);

        let selectedPlan: PlanInfo | null = null;

        for (const candidateId of planIdCandidates) {
          const found = planos.find((item) => item.id === candidateId);
          if (found) {
            selectedPlan = found;
            break;
          }
        }

        if (!selectedPlan && planNameCandidate) {
          const normalizedName = planNameCandidate.toLowerCase();
          selectedPlan =
            planos.find(
              (item) => (item.nome ?? "").toLowerCase() === normalizedName,
            ) ?? null;
        }

        if (!selectedPlan) {
          selectedPlan = {
            id: parsedPlanId,
            nome: planNameCandidate,
            modules: [],
            limits: {
              users: null,
              clients: null,
              processes: null,
              proposals: null,
              oabs: null,
            },
          };
        }

        setPlan(selectedPlan);
        setIsLoading(false);
        setError(null);
        return selectedPlan;
      } catch (loadError) {
        if (signal?.aborted) {
          return null;
        }

        console.error("Erro ao carregar plano atual", loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o plano atual.";
        setError(message);
        setPlan(null);
        setIsLoading(false);
        return null;
      }
    },
    [isAuthenticated, user?.empresa_id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPlan(controller.signal).catch((error) => {
      if (error && (error as { name?: string }).name !== "AbortError") {
        console.warn("Falha ao carregar plano", error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadPlan]);

  const refetch = useCallback(() => loadPlan(), [loadPlan]);

  const value = useMemo<PlanContextValue>(
    () => ({ plan, isLoading, error, refetch }),
    [plan, isLoading, error, refetch],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan deve ser utilizado dentro de um PlanProvider");
  }
  return context;
};
