import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bot, Check, Download, PlayCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { lessonsOf, productBySlug, storeBySlug } from '@/lib/loja/db';
import { formatBRL } from '@/lib/loja/rules';
import { Avatar, KindTag, Shell, StoreFooter, accessLabel } from '@/components/loja/ui';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ loja: string; produto: string }> };

async function load(slug: string, productSlug: string) {
  const store = await storeBySlug(slug);
  const product = store ? await productBySlug(store.id, productSlug) : null;
  return store && product?.published ? { store, product } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { loja, produto } = await params;
  const found = await load(loja, produto).catch(() => null);
  if (!found) return { title: 'Produto não encontrado' };
  return { title: { absolute: `${found.product.title} · ${found.store.name}` }, description: found.product.headline ?? undefined, robots: { index: true, follow: true } };
}

/** Página de venda de um produto, com o formulário que leva ao Checkout Pro. */
export default async function ProductPage({ params }: Params) {
  const { loja, produto } = await params;
  const found = await load(loja, produto);
  if (!found) notFound();
  const { store, product } = found;
  const lessons = product.kind === 'curso' ? await lessonsOf(product.id) : [];

  const perks = [
    product.kind === 'ia' && { icon: Bot, text: `Converse com a IA de ${store.name}, feita com o material da loja` },
    product.kind === 'curso' && { icon: PlayCircle, text: `${lessons.length} ${lessons.length === 1 ? 'aula' : 'aulas'} em vídeo` },
    product.kind === 'curso' && product.ai_enabled && { icon: Bot, text: 'IA tira-dúvidas treinada no curso' },
    product.kind === 'download' && { icon: Download, text: 'Link pra baixar logo depois do pagamento' },
    { icon: Check, text: accessLabel(product.access_days) },
    { icon: Check, text: 'Pix ou cartão em até 12x pelo Mercado Pago' },
  ].filter(Boolean) as { icon: typeof Check; text: string }[];

  return (
    <Shell>
      <Link href={`/l/${store.slug}`} className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-ink">
        <Avatar src={store.avatar_url} name={store.name} size={28} /> {store.name}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <article className="min-w-0">
          <KindTag kind={product.kind} />
          <h1 className="mt-3 font-display text-[30px] font-bold leading-tight text-balance sm:text-[36px]">{product.title}</h1>
          {product.headline && <p className="mt-3 text-[17px] leading-relaxed text-ink-2 text-pretty">{product.headline}</p>}

          <ul className="mt-6 space-y-2">
            {perks.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] text-ink-2">
                <p.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-ink" aria-hidden />{p.text}
              </li>
            ))}
          </ul>

          {product.description && (
            <div className="prose-loja mt-8 space-y-3 text-[15px] leading-relaxed text-ink-2">
              <ReactMarkdown>{product.description}</ReactMarkdown>
            </div>
          )}

          {lessons.length > 0 && (
            <section className="mt-8">
              <h2 className="eyebrow mb-3">O que tem no curso</h2>
              <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
                {lessons.map((l, i) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                    <span className="font-mono text-[12px] text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>{l.title}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-display text-[32px] font-bold leading-none">{formatBRL(product.price_cents)}</p>
            <p className="mt-1 font-mono text-[12px] text-muted">{accessLabel(product.access_days)} · pagamento único</p>
            <CheckoutForm store={store.slug} product={product.slug} />
          </div>
        </aside>
      </div>
      <StoreFooter slug={store.slug} />
    </Shell>
  );
}
