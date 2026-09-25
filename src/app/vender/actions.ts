'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSeller, SellerAuthError } from '@/lib/loja/auth';
import {
  createOrder, createStore, deleteProduct, disconnectMp, LojaError, orderById, productFull, replaceLessons, saveProduct,
  siteUrl, storeByOwner, updateStore, type Store,
} from '@/lib/loja/db';
import { newAccessToken } from '@/lib/loja/crypto';
import { grantManually } from '@/lib/loja/orders';
import {
  clampKnowledge, feeBpsFromEnv, isEmail, isProductKind, parseLessons, parsePriceCents, priceError, safeHttpsUrl, slugError, slugify,
} from '@/lib/loja/rules';

// Ações do painel da Loja. Toda ação confere login e pega a loja pelo owner_id de quem está
// logado: ninguém mexe na loja de outra pessoa, mesmo chamando a ação direto.

export type FormState = { ok?: boolean; error?: string; message?: string };

function text(form: FormData, name: string, max = 500): string {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function myStore(): Promise<Store> {
  const user = await requireSeller();
  const store = await storeByOwner(user.id);
  if (!store) throw new LojaError('Crie sua loja primeiro.');
  return store;
}

function fail(e: unknown): FormState {
  if (e instanceof SellerAuthError || e instanceof LojaError) return { error: e.message };
  console.error('[loja] ação falhou:', e);
  return { error: 'Não consegui salvar. Tente de novo em instantes.' };
}

export async function saveStoreAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await requireSeller();
    const name = text(form, 'name', 80);
    const slug = slugify(text(form, 'slug', 60) || name);
    if (!name) return { error: 'Dê um nome pra loja.' };
    const bad = slugError(slug);
    if (bad) return { error: bad };
    const bio = text(form, 'bio', 400) || null;
    const avatar = text(form, 'avatar_url', 500);
    const avatar_url = avatar ? safeHttpsUrl(avatar) : null;
    if (avatar && !avatar_url) return { error: 'A foto precisa ser um link https.' };
    const instagram = text(form, 'instagram', 40).replace(/^@/, '') || null;
    if (instagram && !/^[\w.]{1,30}$/.test(instagram)) return { error: 'Instagram inválido.' };

    const existing = await storeByOwner(user.id);
    if (existing) {
      await updateStore(existing.id, { name, slug, bio, avatar_url, instagram });
    } else {
      await createStore({ owner_id: user.id, slug, name, bio, fee_bps: feeBpsFromEnv(process.env.LOJA_TAXA_PERCENT) });
      if (avatar_url || instagram) {
        const created = await storeByOwner(user.id);
        if (created) await updateStore(created.id, { avatar_url, instagram });
      }
    }
    revalidatePath('/vender');
    return { ok: true, message: 'Loja salva.' };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProductAction(_: FormState, form: FormData): Promise<FormState> {
  let savedId: string;
  try {
    const store = await myStore();
    const id = text(form, 'id', 40) || null;
    if (id) {
      const current = await productFull(id);
      if (!current || current.store_id !== store.id) return { error: 'Produto não encontrado.' };
    }
    const kind = text(form, 'kind', 20);
    if (!isProductKind(kind)) return { error: 'Escolha o tipo do produto.' };
    const title = text(form, 'title', 120);
    if (!title) return { error: 'Dê um nome pro produto.' };
    const slug = slugify(text(form, 'slug', 60) || title);
    const bad = slugError(slug);
    if (bad) return { error: bad };
    const price = parsePriceCents(text(form, 'price', 20));
    const badPrice = priceError(price);
    if (badPrice) return { error: badPrice };
    const daysRaw = text(form, 'access_days', 10);
    const access_days = daysRaw ? Math.round(Number(daysRaw)) : null;
    if (access_days != null && !(access_days >= 1 && access_days <= 3650)) return { error: 'Dias de acesso: de 1 a 3650, ou vazio pra sempre.' };
    const limitRaw = Math.round(Number(text(form, 'ai_messages_limit', 10) || 200));
    if (!(limitRaw >= 1 && limitRaw <= 100_000)) return { error: 'Limite de mensagens da IA: de 1 a 100.000.' };

    const ai_enabled = kind === 'ia' || form.get('ai_enabled') === 'on';
    const knowledge = typeof form.get('ai_knowledge') === 'string' ? clampKnowledge(String(form.get('ai_knowledge')).trim()) : '';
    const downloadRaw = text(form, 'download_url', 1000);
    const download_url = downloadRaw ? safeHttpsUrl(downloadRaw) : null;
    if (kind === 'download' && !download_url) return { error: 'Coloque o link https do arquivo (Google Drive, Dropbox…).' };
    const lessons = parseLessons(typeof form.get('lessons') === 'string' ? String(form.get('lessons')) : '');
    if (kind === 'curso' && !lessons.length) return { error: 'Adicione pelo menos uma aula.' };
    if (ai_enabled && !knowledge && !text(form, 'ai_instructions', 10)) return { error: 'Explique pra IA como falar ou cole o seu material.' };

    savedId = await saveProduct(store.id, id, {
      kind, title, slug,
      headline: text(form, 'headline', 200) || null,
      description: text(form, 'description', 8000) || null,
      price_cents: price!,
      access_days,
      published: form.get('published') === 'on',
      welcome: text(form, 'welcome', 2000) || null,
      ai_enabled,
      ai_instructions: text(form, 'ai_instructions', 8000) || null,
      ai_knowledge: knowledge || null,
      ai_messages_limit: limitRaw,
      download_url: kind === 'download' ? download_url : null,
    });
    await replaceLessons(savedId, kind === 'curso' ? lessons : []);
    revalidatePath('/vender');
    revalidatePath(`/l/${store.slug}`);
  } catch (e) {
    return fail(e);
  }
  redirect(`/vender?salvo=${encodeURIComponent(savedId)}`);
}

export async function deleteProductAction(id: string): Promise<FormState> {
  try {
    const store = await myStore();
    await deleteProduct(store.id, id);
    revalidatePath('/vender');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectMpAction(): Promise<FormState> {
  try {
    const store = await myStore();
    await disconnectMp(store.id);
    revalidatePath('/vender');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Libera o acesso de um pedido pendente (pagou por fora ou é cortesia). */
export async function grantOrderAction(orderId: string): Promise<FormState> {
  try {
    const store = await myStore();
    const order = await orderById(orderId);
    if (!order || order.store_id !== store.id) return { error: 'Pedido não encontrado.' };
    if (order.status === 'paid') return { ok: true };
    const product = await productFull(order.product_id);
    await grantManually(order, product?.access_days ?? null);
    revalidatePath('/vender');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Cortesia: dá o produto de graça pra um e-mail (parceiro, sorteio, teste). Devolve o link. */
export async function giftAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const store = await myStore();
    const productId = text(form, 'product_id', 40);
    const product = productId ? await productFull(productId) : null;
    if (!product || product.store_id !== store.id) return { error: 'Escolha o produto.' };
    const email = text(form, 'email', 254).toLowerCase();
    if (!isEmail(email)) return { error: 'E-mail inválido.' };
    const token = newAccessToken();
    const order = await createOrder({
      store_id: store.id, product_id: product.id, buyer_email: email, buyer_name: text(form, 'name', 120) || null,
      amount_cents: 0, fee_cents: 0, access_token: token, source: 'manual',
    });
    await grantManually(order, product.access_days);
    revalidatePath('/vender');
    return { ok: true, message: `${siteUrl()}/acesso/${token}` };
  } catch (e) {
    return fail(e);
  }
}
