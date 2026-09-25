import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Segredos da Loja: tokens do Mercado Pago de cada criador e o link de acesso de cada compra.
// Cifra com AES-256-GCM usando LOJA_ENCRYPTION_KEY (qualquer texto longo; vira chave de 32 bytes
// por SHA-256). Formato guardado: v1.<iv>.<tag>.<dados>, tudo em base64url.

function key(secret = process.env.LOJA_ENCRYPTION_KEY): Buffer {
  if (!secret || secret.length < 16) throw new Error('LOJA_ENCRYPTION_KEY não configurada (mínimo 16 caracteres).');
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(sealed: string, secret?: string): string {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || data == null) throw new Error('Segredo em formato desconhecido.');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Link de acesso do comprador: 32 bytes aleatórios (não dá pra adivinhar). */
export function newAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function looksLikeToken(v: string): boolean {
  return /^[\w-]{43}$/.test(v);
}

/** `state` do OAuth do Mercado Pago: id da loja + validade, assinado (evita CSRF). */
export function signState(storeId: string, now = Date.now(), secret?: string): string {
  const payload = `${storeId}.${now + 15 * 60_000}`;
  const sig = createHmac('sha256', key(secret)).update(`mp-state:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyState(state: string, now = Date.now(), secret?: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [storeId, exp, sig] = parts;
  const expected = createHmac('sha256', key(secret)).update(`mp-state:${storeId}.${exp}`).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  if (!(Number(exp) > now)) return null;
  return storeId;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
