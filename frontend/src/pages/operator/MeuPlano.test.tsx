import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import MeuPlano from "./MeuPlano";

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];

const useAuthMock = vi.fn();
const evaluateAccessMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/auth/subscriptionStatus", () => ({
  evaluateSubscriptionAccess: (subscription: unknown) => evaluateAccessMock(subscription),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/config/routes", () => ({
  routes: {
    meuPlanoPayment: "/meu-plano/pagamento",
    subscription: (id: string) => `/assinaturas/${id}`,
  },
}));

vi.mock("@/lib/api", () => ({
  getApiBaseUrl: () => "https://api.test",
  getApiUrl: (path: string) => `https://api.test/${path}`,
  joinUrl: (...parts: string[]) => parts.filter(Boolean).join(""),
}));

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const defaultPlanResponse = [
  {
    id: 1,
    nome: "Plano Ouro",
    ativo: true,
    descricao: "Plano principal",
    valor_mensal: 199,
    recursos: ["Suporte prioritário"],
  },
];

const defaultEmpresasResponse = [
  {
    plano_id: 1,
    asaasSubscriptionId: "sub_123",
  },
];

const defaultUsuariosResponse = [{ id: 10 }];

const defaultClientesResponse = { total: 4 };

describe("MeuPlano - pagamentos recentes", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    evaluateAccessMock.mockReturnValue({ hasAccess: true });
    window.localStorage.setItem("subscriptionId", "sub_123");
  });

  afterEach(() => {
    (global.fetch as unknown) = originalFetch;
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  const setupCommonFetchResponses = () => {
    const fetchMock = global.fetch as unknown as vi.Mock<Promise<Response>, FetchCall>;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/planos")) {
        return createJsonResponse(defaultPlanResponse);
      }

      if (url.includes("/api/empresas")) {
        return createJsonResponse(defaultEmpresasResponse);
      }

      if (url.includes("/api/usuarios/empresa")) {
        return createJsonResponse(defaultUsuariosResponse);
      }

      if (url.includes("/api/clientes/ativos/total")) {
        return createJsonResponse(defaultClientesResponse);
      }

      return createJsonResponse({});
    });

    return fetchMock;
  };

  it("exibe QR Code PIX quando há pagamento pendente", async () => {
    const fetchMock = setupCommonFetchResponses();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/planos")) {
        return createJsonResponse(defaultPlanResponse);
      }

      if (url.includes("/api/empresas")) {
        return createJsonResponse(defaultEmpresasResponse);
      }

      if (url.includes("/api/usuarios/empresa")) {
        return createJsonResponse(defaultUsuariosResponse);
      }

      if (url.includes("/api/clientes/ativos/total")) {
        return createJsonResponse(defaultClientesResponse);
      }

      if (url.includes("/site/asaas/subscriptions/sub_123/payments")) {
        return createJsonResponse({
          data: [
            {
              id: "pay_1",
              status: "PENDING",
              billingType: "PIX",
              dueDate: "2024-05-20",
              value: 199,
            },
          ],
        });
      }

      if (url.includes("/site/asaas/payments/pay_1/pix")) {
        return createJsonResponse({
          encodedImage: "iVBORw0KGgo=",
          payload: "000201PIXCODE",
          expirationDate: "2024-05-21T00:00:00Z",
        });
      }

      return createJsonResponse({});
    });

    useAuthMock.mockReturnValue({
      user: { subscription: { status: "past_due", planId: 1 }, empresa_nome: "Empresa Teste", email: "contato@example.com" },
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MeuPlano />
      </MemoryRouter>,
    );

    expect(await screen.findByAltText("QR Code PIX")).toBeInTheDocument();
    expect(screen.getByText(/código copia e cola/i)).toBeInTheDocument();
    expect(screen.getByText(/pix/i)).toBeInTheDocument();
    expect(screen.getByText(/pagamento pendente/i)).toBeInTheDocument();
  });

  it("mostra badge de cobrança ativa quando o último pagamento está confirmado", async () => {
    const fetchMock = setupCommonFetchResponses();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/planos")) {
        return createJsonResponse(defaultPlanResponse);
      }

      if (url.includes("/api/empresas")) {
        return createJsonResponse(defaultEmpresasResponse);
      }

      if (url.includes("/api/usuarios/empresa")) {
        return createJsonResponse(defaultUsuariosResponse);
      }

      if (url.includes("/api/clientes/ativos/total")) {
        return createJsonResponse(defaultClientesResponse);
      }

      if (url.includes("/site/asaas/subscriptions/sub_123/payments")) {
        return createJsonResponse({
          data: [
            {
              id: "pay_2",
              status: "CONFIRMED",
              billingType: "CREDIT_CARD",
              dueDate: "2024-05-20",
              value: 199,
            },
          ],
        });
      }

      return createJsonResponse({});
    });

    useAuthMock.mockReturnValue({
      user: { subscription: { status: "active", planId: 1 }, empresa_nome: "Empresa Teste", email: "contato@example.com" },
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MeuPlano />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/cobrança ativa/i)).toBeInTheDocument();
    expect(screen.queryByAltText("QR Code PIX")).not.toBeInTheDocument();
  });
});
