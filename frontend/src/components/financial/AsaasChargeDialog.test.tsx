import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AsaasChargeDialog } from "./AsaasChargeDialog";
import type { AsaasCharge, Flow } from "@/lib/flows";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/flows", async () => {
  const actual = await vi.importActual<typeof import("@/lib/flows")>("@/lib/flows");
  return {
    ...actual,
    fetchChargeDetails: vi.fn().mockResolvedValue(null),
    listChargeStatus: vi.fn().mockResolvedValue([]),
    fetchCustomerSyncStatus: vi.fn().mockResolvedValue(null),
    syncCustomerNow: vi.fn().mockResolvedValue(undefined),
    createAsaasCharge: vi.fn().mockResolvedValue({ paymentMethod: "PIX" }),
    tokenizeCard: vi.fn().mockResolvedValue({ token: "token" }),
    refundAsaasCharge: vi
      .fn()
      .mockResolvedValue({
        charge: { paymentMethod: "PIX" },
        flow: { id: 1, tipo: "receita", descricao: "", vencimento: "", valor: 0, status: "pendente" },
      }),
  } as typeof actual;
});

describe("AsaasChargeDialog", () => {
  let queryClient: QueryClient | null = null;

  afterEach(() => {
    cleanup();
    queryClient?.clear();
    queryClient = null;
    vi.clearAllMocks();
  });

  const renderDialog = (override?: Partial<AsaasCharge>) => {
    queryClient = new QueryClient();

    const flow: Flow = {
      id: 1,
      tipo: "receita",
      descricao: "Fluxo de teste",
      vencimento: "2024-01-01",
      valor: 100,
      status: "pendente",
    };

    const persistedCharge: AsaasCharge = {
      paymentMethod: "PIX",
      pixPayload: "000201010211",
      pixQrCode: "iVBORw0KGgo",
      ...override,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AsaasChargeDialog
          flow={flow}
          open
          onOpenChange={() => {}}
          customers={[]}
          customersLoading={false}
          onChargeCreated={vi.fn()}
          onStatusUpdated={vi.fn()}
          persistedCharge={persistedCharge}
          persistedStatuses={[]}
        />
      </QueryClientProvider>,
    );
  };

  it("renderiza o QR Code e o botão de cópia quando disponível", () => {
    renderDialog();

    const image = screen.getByAltText(/qr code pix/i) as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.src).toContain("data:image/png;base64,iVBORw0KGgo");

    expect(screen.getByRole("button", { name: "Copiar código PIX" })).toBeInTheDocument();
  });
});
