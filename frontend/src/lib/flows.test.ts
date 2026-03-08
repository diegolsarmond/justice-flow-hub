import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAsaasCharge, normalizeCharge, type AsaasPaymentMethod } from './flows';

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) {
    global.fetch = originalFetch;
  }
});

describe('normalizeCharge', () => {
  test('captura cardBrand e cardLast4 a partir de aliases conhecidos', () => {
    const normalized = normalizeCharge({
      charge: {
        id: 'charge_1',
        paymentMethod: 'CREDIT_CARD',
        card_brand: 'Mastercard',
        cardLastDigits: 9876,
      },
    });

    expect(normalized?.cardBrand).toBe('Mastercard');
    expect(normalized?.cardLast4).toBe('9876');
  });

  test('utiliza os dados aninhados do cartão quando disponíveis', () => {
    const normalized = normalizeCharge({
      charge: {
        id: 'charge_2',
        paymentMethod: 'CREDIT_CARD',
        creditCard: {
          brand: 'Visa',
          last4Digits: '1234',
        },
      },
    });

    expect(normalized?.cardBrand).toBe('Visa');
    expect(normalized?.cardLast4).toBe('1234');
  });
});

describe('createAsaasCharge', () => {
  test('sends debit card payment method to API and normalizes response', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const bodyText = init?.body ? String(init.body) : '';
      const parsedBody = bodyText ? JSON.parse(bodyText) : {};

      expect(parsedBody.paymentMethod).toBe<'DEBIT_CARD'>('DEBIT_CARD');

      const responsePayload = {
        charge: {
          id: 'ch_debit_front',
          paymentMethod: 'DEBIT_CARD' satisfies AsaasPaymentMethod,
          billingType: 'DEBIT_CARD',
          status: 'PENDING',
        },
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const charge = await createAsaasCharge(123, {
      customerId: 'cus_123',
      paymentMethod: 'DEBIT_CARD',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(charge.paymentMethod).toBe('DEBIT_CARD');
    expect(charge.id).toBe('ch_debit_front');
  });
});
