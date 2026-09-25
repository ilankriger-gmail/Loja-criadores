import { describe, expect, it } from 'vitest';
import {
  accessState, clampKnowledge, expiresAtFrom, feeBpsFromEnv, feeCents, formatBRL, isEmail, parseLessons, parsePriceCents,
  priceError, safeHttpsUrl, slugError, slugify, videoEmbedUrl,
} from '../rules';

describe('slug', () => {
  it('vira endereço sem acento nem espaço', () => {
    expect(slugify('Curso do Ilan: Viralização!')).toBe('curso-do-ilan-viralizacao');
    expect(slugify('  --Olá  Mundo--  ')).toBe('ola-mundo');
  });
  it('recusa curto, reservado e caractere inválido', () => {
    expect(slugError('ab')).toMatch(/3 letras/);
    expect(slugError('vender')).toMatch(/reservado/);
    expect(slugError('meu_nome')).toMatch(/minúsculas/);
    expect(slugError('ilan-kriger')).toBeNull();
  });
});

describe('preço', () => {
  it.each([
    ['97', 9700], ['97,90', 9790], ['R$ 1.297,00', 129700], ['97.9', 9790], ['1,297.50', 129750], ['1.297', 129700], ['0,99', 99],
  ])('%s → %i centavos', (input, cents) => expect(parsePriceCents(input)).toBe(cents));
  it('não é preço', () => {
    expect(parsePriceCents('')).toBeNull();
    expect(parsePriceCents('abc')).toBeNull();
    expect(parsePriceCents('-10')).toBeNull();
  });
  it('limites', () => {
    expect(priceError(99)).toMatch(/mínimo/);
    expect(priceError(1_000_001)).toMatch(/máximo/);
    expect(priceError(9700)).toBeNull();
  });
  it('formata em real', () => expect(formatBRL(129790).replace(/\s/g, ' ')).toBe('R$ 1.297,90'));
});

describe('taxa da plataforma', () => {
  it('5% arredonda pra baixo', () => {
    expect(feeCents(9700, 500)).toBe(485);
    expect(feeCents(9790, 500)).toBe(489); // 489,5 → 489
    expect(feeCents(100, 0)).toBe(0);
  });
  it('lê LOJA_TAXA_PERCENT', () => {
    expect(feeBpsFromEnv(undefined)).toBe(500);
    expect(feeBpsFromEnv('7,5')).toBe(750);
    expect(feeBpsFromEnv('90')).toBe(500);
    expect(feeBpsFromEnv('x')).toBe(500);
  });
});

describe('acesso', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  it('pago e dentro do prazo', () => {
    expect(accessState({ status: 'paid', expires_at: null }, now)).toEqual({ ok: true, expiresAt: null });
    expect(accessState({ status: 'paid', expires_at: '2026-10-01T00:00:00Z' }, now).ok).toBe(true);
  });
  it('pendente, reembolsado, vencido', () => {
    expect(accessState({ status: 'pending', expires_at: null }, now)).toEqual({ ok: false, reason: 'pending' });
    expect(accessState({ status: 'refunded', expires_at: null }, now)).toEqual({ ok: false, reason: 'refunded' });
    expect(accessState({ status: 'paid', expires_at: '2026-09-25T12:00:00Z' }, now)).toEqual({ ok: false, reason: 'expired' });
  });
  it('fim do acesso', () => {
    expect(expiresAtFrom(now, null)).toBeNull();
    expect(expiresAtFrom(now, 30)?.toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });
});

describe('vídeo das aulas', () => {
  it.each([
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/123456/abcdef12', 'https://player.vimeo.com/video/123456?h=abcdef12'],
    ['https://www.loom.com/share/0123abcd', 'https://www.loom.com/embed/0123abcd'],
  ])('%s', (url, embed) => expect(videoEmbedUrl(url)).toBe(embed));
  it('recusa http, javascript e site desconhecido', () => {
    expect(videoEmbedUrl('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(videoEmbedUrl('https://exemplo.com/video.mp4')).toBeNull();
  });
});

describe('formulário', () => {
  it('aulas: ignora sem título e lixo', () => {
    expect(parseLessons(JSON.stringify([{ title: ' Aula 1 ', video_url: '', body: 'x' }, { title: '' }, 3, null]))).toEqual([
      { title: 'Aula 1', video_url: null, body: 'x' },
    ]);
    expect(parseLessons('não é json')).toEqual([]);
  });
  it('material da IA corta no fim de linha', () => {
    const text = 'linha\n'.repeat(100);
    const out = clampKnowledge(text, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith('linha')).toBe(true);
  });
  it('links e e-mail', () => {
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('http://a.com')).toBeNull();
    expect(safeHttpsUrl('https://drive.google.com/x')).toBe('https://drive.google.com/x');
    expect(isEmail('fa@email.com')).toBe(true);
    expect(isEmail('fa@email')).toBe(false);
  });
});
