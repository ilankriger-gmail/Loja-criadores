import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentSeller } from '@/lib/loja/auth';
import { lessonsOf, productFull, siteUrl, storeByOwner } from '@/lib/loja/db';
import { PageHeader } from '@/components/loja/panel';
import { ProductForm } from './ProductForm';

export const dynamic = 'force-dynamic';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentSeller();
  if (!user) return null;
  const store = await storeByOwner(user.id);
  if (!store) redirect('/vender');

  const isNew = id === 'novo';
  const product = isNew ? null : /^[\da-f-]{36}$/i.test(id) ? await productFull(id) : null;
  if (!isNew && (!product || product.store_id !== store.id)) notFound();
  const lessons = product ? await lessonsOf(product.id) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader crumb={<Link href="/vender" className="hover:text-ink">← Minha loja</Link>} title={product ? product.title : 'Novo produto'} />
      <ProductForm
        product={product}
        lessons={lessons.map((l) => ({ title: l.title, video_url: l.video_url ?? '', body: l.body ?? '' }))}
        storeUrl={`${siteUrl()}/l/${store.slug}`}
      />
    </div>
  );
}
