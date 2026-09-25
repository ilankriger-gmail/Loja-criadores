// Regras puras da Loja (sem banco, sem rede): testadas em __tests__/rules.test.ts.

export const PRODUCT_KINDS = ['ia', 'curso', 'download'] as const;
export type ProductKind = typeof PRODUCT_KINDS[number];

export const KIND_LABEL: Record<ProductKind, string> = {
  ia: 'IA personalizada',
  curso: 'Curso',
  download: 'Material para baixar',
};

export const KIND_HINT: Record<ProductKind, string> = {
  ia: 'O fã conversa com uma IA que fala do seu jeito e responde com o seu material.',
  curso: 'Aulas em vídeo liberadas depois do pagamento, com IA tira-dúvidas opcional.',
  download: 'PDF, planilha, presets: o link aparece depois do pagamento.',
};

export function isProductKind(v: unknown): v is ProductKind {
  return typeof v === 'string' && (PRODUCT_KINDS as readonly string[]).includes(v);
}

/** Endereços que não podem virar loja (colidem com telas ou confundem o público). */
const RESERVED = new Set(['admin', 'api', 'acesso', 'dashboard', 'login', 'loja', 'vender', 'novo', 'ajuda', 'suporte', 'termos', 'privacidade']);

export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 1_000_000;
export const DEFAULT_FEE_BPS = 500;

/** Transforma um texto em endereço: "Curso do Ilan!" → "curso-do-ilan". */
export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** Erro legível ou null se o endereço serve. */
export function slugError(slug: string): string | null {
  if (slug.length < 3) return 'O endereço precisa de pelo menos 3 letras.';
  if (slug.length > 40) return 'O endereço pode ter no máximo 40 letras.';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use só letras minúsculas, números e hífen (sem acento nem espaço).';
  if (RESERVED.has(slug)) return 'Esse endereço é reservado. Escolha outro.';
  return null;
}

/** "97" · "97,90" · "R$ 1.297,00" · "97.9" → centavos. null se não for preço. */
export function parsePriceCents(input: string): number | null {
  let s = input.replace(/R\$|\s/gi, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');           // 1.297,00
  } else if (lastDot > lastComma && lastComma >= 0) {
    s = s.replace(/,/g, '');                               // 1,297.00
  } else if (lastDot >= 0 && s.length - lastDot - 1 === 3 && s.split('.').length >= 2) {
    s = s.replace(/\./g, '');                              // 1.297 (milhar)
  }
  if ((s.match(/\./g) || []).length > 1) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function priceError(cents: number | null): string | null {
  if (cents == null) return 'Preço inválido. Exemplo: 97,00';
  if (cents < MIN_PRICE_CENTS) return 'O preço mínimo é R$ 1,00.';
  if (cents > MAX_PRICE_CENTS) return 'O preço máximo é R$ 10.000,00.';
  return null;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Taxa da plataforma em centavos, arredondada pra baixo (nunca cobra a mais do criador). */
export function feeCents(priceCents: number, feeBps: number): number {
  return Math.floor((priceCents * feeBps) / 10_000);
}

/** Taxa padrão: LOJA_TAXA_PERCENT (ex.: "5" ou "7,5"), senão 5%. */
export function feeBpsFromEnv(raw: string | undefined): number {
  if (!raw) return DEFAULT_FEE_BPS;
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 50) return DEFAULT_FEE_BPS;
  return Math.round(n * 100);
}

export type AccessState =
  | { ok: true; expiresAt: Date | null }
  | { ok: false; reason: 'pending' | 'refunded' | 'cancelled' | 'expired' };

/** O comprador pode entrar? Pago e dentro do prazo. */
export function accessState(order: { status: string; expires_at: string | null }, now = new Date()): AccessState {
  if (order.status === 'pending') return { ok: false, reason: 'pending' };
  if (order.status === 'refunded') return { ok: false, reason: 'refunded' };
  if (order.status !== 'paid') return { ok: false, reason: 'cancelled' };
  const expiresAt = order.expires_at ? new Date(order.expires_at) : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true, expiresAt };
}

/** Fim do acesso a partir do pagamento. null = pra sempre. */
export function expiresAtFrom(paidAt: Date, accessDays: number | null): Date | null {
  if (!accessDays) return null;
  return new Date(paidAt.getTime() + accessDays * 86_400_000);
}

/** Link de vídeo (YouTube, Vimeo, Bunny, Loom) → endereço pra embutir. null se não reconhecer. */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const [id, hash] = u.pathname.slice(1).split('/');
    if (!/^\d+$/.test(id || '')) return null;
    return `https://player.vimeo.com/video/${id}${hash && /^[\da-f]+$/i.test(hash) ? `?h=${hash}` : ''}`;
  }
  if (host === 'player.vimeo.com' || host === 'iframe.mediadelivery.net' || host === 'player.mediadelivery.net') return u.toString();
  if (host === 'loom.com') {
    const id = u.pathname.match(/^\/(?:share|embed)\/([\da-f]+)/i)?.[1];
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}

export interface LessonInput { title: string; video_url: string | null; body: string | null }

/** Aulas vindas do formulário (JSON). Ignora aula sem título; no máximo 200. */
export function parseLessons(raw: string | null | undefined): LessonInput[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.slice(0, 200).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const o = item as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : '';
    if (!title) return [];
    const video = typeof o.video_url === 'string' ? o.video_url.trim().slice(0, 500) : '';
    const body = typeof o.body === 'string' ? o.body.trim().slice(0, 20_000) : '';
    return [{ title, video_url: video || null, body: body || null }];
  });
}

/** Material da IA: corta no limite sem partir no meio de uma linha. */
export const MAX_KNOWLEDGE_CHARS = 300_000;
export function clampKnowledge(text: string, max = MAX_KNOWLEDGE_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const nl = cut.lastIndexOf('\n');
  return nl > max * 0.8 ? cut.slice(0, nl) : cut;
}

/** Link seguro pra página pública: só https (evita javascript: e afins). */
export function safeHttpsUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

export function isEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/**
 * Limites de tentativas: [máximo, janela em segundos]. Por IP é folgado porque no celular muita
 * gente sai pelo mesmo IP da operadora (CGNAT); por e-mail é apertado pra ninguém lotar a caixa alheia.
 */
export const LIMITS = {
  'checkout-ip': [30, 600],
  'checkout-email': [10, 3600],
  'recuperar-ip': [10, 3600],
  'recuperar-email': [3, 3600],
} as const satisfies Record<string, readonly [number, number]>;
export type LimitKind = keyof typeof LIMITS;

/** IP de quem chamou. Na Vercel x-real-ip e x-forwarded-for são gravados por ela (não dá pra forjar). */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const ip = headers.get('x-real-ip')?.trim() || headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip && ip.length <= 64 ? ip : null;
}
