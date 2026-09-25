import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { productsOfStore, storeBySlug } from '@/lib/loja/db';
import { formatBRL } from '@/lib/loja/rules';
import { Avatar, KindTag, Shell, StoreFooter, accessLabel } from '@/components/loja/ui';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ loja: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await storeBySlug((await params).loja).catch(() => null);
  if (!store) return { title: 'Loja não encontrada' };
  return { title: { absolute: store.name }, description: store.bio ?? `Produtos de ${store.name}`, robots: { index: true, follow: true } };
}

/** Vitrine: o link único da bio, com todos os produtos publicados. */
export default async function StorePage({ params }: Params) {
  const store = await storeBySlug((await params).loja);
  if (!store) notFound();
  const products = await productsOfStore(store.id, { onlyPublished: true });

  return (
    <Shell narrow>
      <header className="flex flex-col items-center text-center">
        <Avatar src={store.avatar_url} name={store.name} size={88} />
        <h1 className="mt-4 font-display text-[28px] font-bold leading-tight text-balance">{store.name}</h1>
        {store.instagram && (
          <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className="mt-1 font-mono text-[12.5px] text-muted hover:text-ink">@{store.instagram}</a>
        )}
        {store.bio && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2 text-pretty whitespace-pre-line">{store.bio}</p>}
      </header>

      <section className="mt-8 space-y-3" aria-label="Produtos">
        {products.length === 0 && <p className="text-center text-muted">Nenhum produto por aqui ainda.</p>}
        {products.map((p) => (
          <Link key={p.id} href={`/l/${store.slug}/${p.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60">
            <div className="min-w-0 flex-1">
              <KindTag kind={p.kind} />
              <h2 className="mt-2 font-display text-[18px] font-semibold leading-snug text-balance">{p.title}</h2>
              {p.headline && <p className="mt-1 text-[14px] text-ink-2 text-pretty">{p.headline}</p>}
              <p className="mt-2 font-mono text-[12px] text-muted">{formatBRL(p.price_cents)} · {accessLabel(p.access_days)}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-ink" aria-hidden />
          </Link>
        ))}
      </section>
      <StoreFooter contact={store.support_email} />
    </Shell>
  );
}
