import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, hashToken, looksLikeToken, newAccessToken, signState, verifyState } from '../crypto';
import { orderStatusFor, preferenceBody, verifyWebhookSignature } from '../mercadopago';

const KEY = 'chave-de-teste-com-mais-de-16-caracteres';

describe('cifra', () => {
  it('ida e volta, e muda a cada vez', () => {
    const a = encrypt('APP_USR-123', KEY);
    expect(a).not.toContain('APP_USR');
    expect(decrypt(a, KEY)).toBe('APP_USR-123');
    expect(encrypt('APP_USR-123', KEY)).not.toBe(a);
  });
  it('chave errada ou texto adulterado falham', () => {
    const a = encrypt('segredo', KEY);
    expect(() => decrypt(a, 'outra-chave-com-mais-de-16-chars')).toThrow();
    const [v, iv, tag, data] = a.split('.');
    expect(() => decrypt([v, iv, tag, data.slice(0, -2) + 'AA'].join('.'), KEY)).toThrow();
  });
  it('exige chave configurada', () => expect(() => encrypt('x', 'curta')).toThrow(/LOJA_ENCRYPTION_KEY/));
});

describe('link de acesso', () => {
  it('43 caracteres base64url e hash estável', () => {
    const t = newAccessToken();
    expect(looksLikeToken(t)).toBe(true);
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(looksLikeToken('../../etc')).toBe(false);
  });
});

describe('state do OAuth', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  it('assinado e com validade', () => {
    const now = 1_000_000;
    const s = signState(id, now, KEY);
    expect(verifyState(s, now + 60_000, KEY)).toBe(id);
    expect(verifyState(s, now + 16 * 60_000, KEY)).toBeNull();
  });
  it('trocar a loja invalida a assinatura', () => {
    const s = signState(id, 0, KEY);
    const forged = s.replace(id, '99999999-2222-3333-4444-555555555555');
    expect(verifyState(forged, 1, KEY)).toBeNull();
  });
});

describe('webhook do Mercado Pago', () => {
  const secret = 'segredo-do-webhook';
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');
  it('aceita assinatura certa', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1700000000;');
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '123456', secret })).toBe(true);
  });
  it('id alfanumérico vai em minúsculas', () => {
    const v1 = sign('id:abc123;request-id:r;ts:1;');
    expect(verifyWebhookSignature({ signature: `ts=1,v1=${v1}`, requestId: 'r', dataId: 'ABC123', secret })).toBe(true);
  });
  it('recusa assinatura errada ou ausente', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1700000000;');
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '999', secret })).toBe(false);
    expect(verifyWebhookSignature({ signature: null, requestId: 'req-1', dataId: '123456', secret })).toBe(false);
    expect(verifyWebhookSignature({ signature: 'lixo', requestId: 'req-1', dataId: '123456', secret })).toBe(false);
  });
  it('status do pagamento → status do pedido', () => {
    expect(orderStatusFor('approved')).toBe('paid');
    expect(orderStatusFor('charged_back')).toBe('refunded');
    expect(orderStatusFor('rejected')).toBe('cancelled');
    expect(orderStatusFor('in_process')).toBeNull();
  });
});

describe('preferência do Checkout Pro', () => {
  it('preço do banco, taxa em reais e referência do pedido', () => {
    const body = preferenceBody({
      orderId: 'o1', productId: 'p1', title: 'IA do Ilan', priceCents: 9790, feeCents: 489,
      buyerEmail: 'fa@email.com', buyerName: null, notificationUrl: 'https://x/webhook', returnUrl: 'https://x/acesso/t', storeName: 'Ilan Kriger!',
    });
    expect(body.items[0]).toMatchObject({ unit_price: 97.9, currency_id: 'BRL', quantity: 1 });
    expect(body.marketplace_fee).toBe(4.89);
    expect(body.external_reference).toBe('o1');
    expect(body.statement_descriptor).toBe('Ilan Kriger');
    expect(body.payer).toEqual({ email: 'fa@email.com' });
  });
});
