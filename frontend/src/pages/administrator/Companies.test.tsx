import { render, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Companies from "./Companies";

vi.mock("@/lib/api", () => ({
  getApiUrl: (path: string) => path,
}));

const originalFetch = global.fetch;
const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit)
  => Promise<Response>
>();

const criarResposta = (dados: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => dados,
  } as Response);

describe("Empresas", () => {
  beforeEach(() => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : String(input);
      if (url === "empresas") {
        return criarResposta([]);
      }
      if (url === "planos") {
        return criarResposta([]);
      }
      if (url === "admin/users") {
        return criarResposta([]);
      }
      return criarResposta([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
    global.fetch = originalFetch;
  });

  it("usa o endpoint administrativo para listar usuários", async () => {
    render(
      <BrowserRouter>
        <Companies />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "admin/users",
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });
  });
});
