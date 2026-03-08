import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIntimacoes } from "./intimacoes";

const originalFetch = global.fetch;

describe("fetchIntimacoes", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("retorna os registros quando a API responde com uma lista", async () => {
    const payload = [
      { id: 1, siglaTribunal: "TJ", external_id: null },
      { id: 2, siglaTribunal: "TJ", external_id: "abc" },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    const result = await fetchIntimacoes();
    expect(result).toEqual(payload);
  });

  it("lança erro quando a resposta não é uma lista", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ erro: true }),
    });

    await expect(fetchIntimacoes()).rejects.toThrow(/Resposta inválida/);
  });
});
