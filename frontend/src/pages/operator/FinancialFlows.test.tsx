import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChargeStatusSummary, getAsaasStatusDisplay } from './FinancialFlows';

describe('getAsaasStatusDisplay', () => {
  it('normaliza status pendente com rótulo e classe amarelos', () => {
    const result = getAsaasStatusDisplay('pending');
    expect(result.label).toBe('Pendente');
    expect(result.badgeClassName).toContain('bg-yellow-100');
  });

  it('normaliza status confirmado com rótulo e classe verdes', () => {
    const result = getAsaasStatusDisplay('CONFIRMED');
    expect(result.label).toBe('Confirmado');
    expect(result.badgeClassName).toContain('bg-emerald-100');
  });

  it('normaliza status em atraso com rótulo e classe vermelhos', () => {
    const result = getAsaasStatusDisplay('OVERDUE');
    expect(result.label).toBe('Em atraso');
    expect(result.badgeClassName).toContain('bg-rose-100');
  });

  it("destaca cobranças do plano e mantém o nome do cliente para outras receitas", async () => {
    const { fetchFlows } = await import("@/lib/flows");
    vi.mocked(fetchFlows).mockResolvedValue([
      {
        id: 1,
        tipo: "despesa",
        descricao: "Assinatura mensal",
        vencimento: "2024-05-01",
        pagamento: null,
        valor: 100,
        status: "pendente",
        origin: "plan-payment",
      },
      {
        id: 2,
        tipo: "receita",
        descricao: "Cliente Solar Ltda",
        vencimento: "2024-05-02",
        pagamento: null,
        valor: 200,
        status: "pendente",
        cliente_id: "cust_1",
      },
    ]);

  it('gera fallback legível mantendo classe neutra para status desconhecido', () => {
    const result = getAsaasStatusDisplay('UNEXPECTED_STATUS');
    expect(result.label).toBe('Unexpected Status');
    expect(result.badgeClassName).toContain('bg-slate-100');
  });
});

describe('ChargeStatusSummary', () => {
  it('exibe mensagem padrão quando não há status registrado', () => {
    render(<ChargeStatusSummary status={null} />);
    expect(screen.getByText('Cobrança gerada')).toBeInTheDocument();
  });

  it('renderiza o badge com tradução amigável do status', () => {
    render(<ChargeStatusSummary status="CONFIRMED" />);

    expect(screen.getByText('Último status:')).toBeInTheDocument();
    const badge = screen.getByText('Confirmado');
    expect(badge.className).toContain('bg-emerald-100');
  });
});
