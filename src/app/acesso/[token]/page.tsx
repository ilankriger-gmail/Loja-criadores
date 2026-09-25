import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Download, RefreshCw, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatHistory, lessonsOf, orderByToken, productFull, storeById } from '@/lib/loja/db';
import { looksLikeToken } from '@/lib/loja/crypto';
import { syncPayment } from '@/lib/loja/orders';
import { accessState, videoEmbedUrl } from '@/lib/loja/rules';
import { Avatar, KindTag, Shell, StoreFooter } from '@/components/loja/ui';
import { cn } from '@/lib/utils';
import { Chat } from './Chat';
import { SaveLink } from './SaveLink';
import { AutoRefresh } from './AutoRefresh';

export const dynamic = 'force-dynamic';

// O link é a chave do comprador: não indexa e não vaza pelo Referer para sites de fora.
export const metadata: Metadata = { title: { absolute: 'Seu acesso' }, robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AccessPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  if (!looksLikeToken(token)) notFound();
  let order = await orderByToken(token);
  if (!order) notFound();

  // volta do Checkout Pro com payment_id: confere na hora, sem esperar o webhook
  const paymentId = typeof sp.payment_id === 'string' ? sp.payment_id : typeof sp.collection_id === 'string' ? sp.collection_id : null;
  if (order.status === 'pending' && paymentId && /^\d{1,20}$/.test(paymentId)) {
    try {
      const synced = await syncPayment(order.store_id, paymentId);
      if (synced?.id === order.id) order = synced;
    } catch (e) {
      console.error('[loja] conferir pagamento na volta:', (e as Error).message);
    }
  }

  const [product, store] = await Promise.all([productFull(order.product_id), storeById(order.store_id)]);
  if (!product || !store) notFound();
  const state = accessState(order);

  const header = (
    <header className="flex items-center gap-3">
      <Avatar src={store.avatar_url} name={store.name} size={44} />
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{store.name}</p>
        <h1 className="font-display text-[22px] font-bold leading-tight text-balance">{product.title}</h1>
      </div>
    </header>
  );

  if (!state.ok) {
    const copy = {
      pending: { icon: Clock, title: 'Pagamento em análise', text: 'Pix costuma cair em segundos; cartão, em até alguns minutos. Esta página libera sozinha quando o pagamento for aprovado.' },
      refunded: { icon: XCircle, title: 'Compra reembolsada', text: 'Este pagamento foi devolvido, então o acesso foi encerrado.' },
      cancelled: { icon: XCircle, title: 'Pagamento não aprovado', text: 'O pagamento foi recusado ou cancelado. Você pode tentar de novo pela página do produto.' },
      expired: { icon: Clock, title: 'Seu acesso terminou', text: 'O período de acesso desta compra acabou. Para continuar, compre de novo pela página do produto.' },
    }[state.reason];
    return (
      <Shell narrow>
        {header}
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center">
          <copy.icon className={cn('mx-auto h-8 w-8', state.reason === 'pending' ? 'text-warn' : 'text-crit')} aria-hidden />
          <h2 className="mt-3 font-display text-[20px] font-bold">{copy.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] text-ink-2 text-pretty">{copy.text}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {state.reason === 'pending' && (
              <Link href={`/acesso/${token}`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#c21f1f]"><RefreshCw className="h-4 w-4" /> Atualizar</Link>
            )}
            {state.reason !== 'pending' && (
              <Link href={`/l/${store.slug}/${product.slug}`} className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10">Ver o produto</Link>
            )}
          </div>
        </section>
        {state.reason === 'pending' && <><SaveLink /><AutoRefresh /></>}
        <StoreFooter slug={store.slug} />
      </Shell>
    );
  }

  const lessons = product.kind === 'curso' ? await lessonsOf(product.id) : [];
  const history = product.ai_enabled ? await chatHistory(order.id, 40) : [];
  const lessonIdx = Math.min(Math.max(Number(sp.aula) || 1, 1), Math.max(lessons.length, 1)) - 1;
  const lesson = lessons[lessonIdx];
  const embed = videoEmbedUrl(lesson?.video_url);
  const remaining = Math.max(0, product.ai_messages_limit - order.messages_used);

  return (
    <Shell narrow={product.kind !== 'curso'}>
      {header}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-muted">
        <KindTag kind={product.kind} />
        <span>{state.expiresAt ? `Acesso até ${state.expiresAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'Acesso pra sempre'}</span>
      </div>
      <SaveLink compact />

      {product.welcome && (
        <div className="prose-loja mt-6 rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink-2">
          <ReactMarkdown>{product.welcome}</ReactMarkdown>
        </div>
      )}

      {product.kind === 'download' && product.download_url && (
        <a href={product.download_url} target="_blank" rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[16px] font-semibold text-white hover:bg-[#c21f1f]">
          <Download className="h-5 w-5" /> Baixar o material
        </a>
      )}

      {product.kind === 'curso' && lesson && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="min-w-0">
            {embed ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
                <iframe src={embed} title={lesson.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              </div>
            ) : lesson.video_url ? (
              <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-line bg-surface p-4 text-accent-ink underline">Abrir o vídeo da aula</a>
            ) : null}
            <h2 className="mt-4 font-display text-[20px] font-bold">{lessonIdx + 1}. {lesson.title}</h2>
            {lesson.body && <div className="prose-loja mt-3 text-[15px] leading-relaxed text-ink-2"><ReactMarkdown>{lesson.body}</ReactMarkdown></div>}
            <div className="mt-5 flex justify-between gap-2 text-sm">
              {lessonIdx > 0 ? <Link href={`/acesso/${token}?aula=${lessonIdx}`} className="text-muted hover:text-ink">← Aula anterior</Link> : <span />}
              {lessonIdx < lessons.length - 1 && <Link href={`/acesso/${token}?aula=${lessonIdx + 2}`} className="font-medium text-accent-ink hover:underline">Próxima aula →</Link>}
            </div>
          </section>
          <nav aria-label="Aulas" className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="eyebrow mb-2">Aulas</h2>
            <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/acesso/${token}?aula=${i + 1}`} aria-current={i === lessonIdx ? 'page' : undefined}
                    className={cn('flex gap-3 px-3 py-2.5 text-[13.5px]', i === lessonIdx ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-raised')}>
                    <span className="font-mono text-[11.5px] text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>{l.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}

      {product.ai_enabled && (
        <Chat token={token} storeName={store.name} initial={history} remaining={remaining} tutor={product.kind === 'curso'} />
      )}
      <StoreFooter slug={store.slug} />
    </Shell>
  );
}
