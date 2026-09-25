import { describe, expect, it } from 'vitest';
import { accessEmail, escapeHtml, recoveryEmail } from '../email-templates';
import { clientIp, LIMITS } from '../rules';

const URL_A = 'https://loja.exemplo.com/acesso/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12';

describe('e-mail de acesso', () => {
  const base = {
    storeName: 'Ilan Kriger', productTitle: 'IA do Ilan', kind: 'ia' as const, accessUrl: URL_A,
    expiresAt: new Date('2026-10-25T15:00:00Z'), buyerName: 'Maria Souza', supportEmail: 'contato@ilan.com',
  };

  it('leva o link, o prazo e o primeiro nome', () => {
    const m = accessEmail(base);
    expect(m.subject).toBe('Seu acesso: IA do Ilan');
    expect(m.html).toContain(`href="${URL_A}"`);
    expect(m.text).toContain(URL_A);
    expect(m.text).toContain('Oi, Maria!');
    expect(m.text).toContain('até 25/10/2026');
    expect(m.text).toContain('conversar com a IA');
    expect(m.text).toContain('contato@ilan.com');
  });

  it('acesso pra sempre e sem nome nem contato', () => {
    const m = accessEmail({ ...base, kind: 'download', expiresAt: null, buyerName: null, supportEmail: null });
    expect(m.text).toContain('Oi!');
    expect(m.text).toContain('pra sempre');
    expect(m.text).toContain('baixar o material');
    expect(m.text).toContain('Fale com Ilan Kriger');
  });

  it('nome da loja e do produto não viram HTML', () => {
    const m = accessEmail({ ...base, storeName: '<script>x</script>', productTitle: 'Curso "top" & <b>raro</b>' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<b>raro</b>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).toContain('Curso &quot;top&quot; &amp; &lt;b&gt;raro&lt;/b&gt;');
  });

  it('assunto numa linha só', () => {
    expect(accessEmail({ ...base, productTitle: 'Linha 1\r\nBcc: x@y.com' }).subject).toBe('Seu acesso: Linha 1 Bcc: x@y.com');
  });
});

describe('e-mail de recuperar acesso', () => {
  it('um item: assunto com o produto', () => {
    const m = recoveryEmail([{ storeName: 'Loja A', productTitle: 'Curso X', accessUrl: URL_A, expiresAt: null }]);
    expect(m.subject).toBe('Seu link de acesso: Curso X');
    expect(m.html).toContain(URL_A);
  });
  it('vários itens: todos os links', () => {
    const m = recoveryEmail([
      { storeName: 'Loja A', productTitle: 'Curso X', accessUrl: `${URL_A}1`, expiresAt: null },
      { storeName: 'Loja B', productTitle: 'IA Y', accessUrl: `${URL_A}2`, expiresAt: new Date('2027-01-01T12:00:00Z') },
    ]);
    expect(m.subject).toBe('Seus links de acesso');
    expect(m.text).toContain(`${URL_A}1`);
    expect(m.text).toContain(`${URL_A}2`);
    expect(m.text).toContain('até 01/01/2027');
  });
});

describe('escapeHtml', () => {
  it('escapa os cinco caracteres', () => expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'));
});

describe('limite de tentativas', () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it('IP pelo cabeçalho da Vercel', () => {
    expect(clientIp(h({ 'x-real-ip': '200.1.2.3' }))).toBe('200.1.2.3');
    expect(clientIp(h({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }))).toBe('200.1.2.3');
    expect(clientIp(h({}))).toBeNull();
  });
  it('por e-mail é mais apertado que por IP', () => {
    expect(LIMITS['recuperar-email'][0]).toBeLessThan(LIMITS['recuperar-ip'][0]);
    expect(LIMITS['checkout-ip'][0]).toBeGreaterThanOrEqual(20); // CGNAT: muita gente no mesmo IP
  });
});
