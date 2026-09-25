import Link from 'next/link';
import { cn } from '@/lib/utils';
import { KIND_LABEL, type ProductKind } from '@/lib/loja/rules';

// Peças das páginas públicas da Loja (vitrine, produto, acesso). Mesmo sistema visual do painel.

export function Shell({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <main className={cn('mx-auto px-4 pb-16 pt-8 sm:px-6', narrow ? 'max-w-2xl' : 'max-w-4xl')}>{children}</main>
    </div>
  );
}

export function Avatar({ src, name, size = 72 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-display font-bold text-accent-ink" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export function KindTag({ kind, className }: { kind: ProductKind; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-line bg-raised px-2.5 py-1 font-mono text-[11px] leading-none text-ink-2', className)}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Rodapé das páginas públicas. `contact` = e-mail de atendimento da loja, quando o criador preencheu. */
export function StoreFooter({ slug, contact }: { slug?: string; contact?: string | null }) {
  return (
    <footer className="mt-16 border-t border-line pt-6 text-center font-mono text-[11.5px] text-faint">
      {contact && <p className="mb-2">Dúvidas? <a href={`mailto:${contact}`} className="text-ink-2 underline hover:text-ink">{contact}</a></p>}
      {slug && <><Link href={`/l/${slug}`} className="hover:text-ink">Voltar à loja</Link> · </>}
      Pagamento seguro pelo Mercado Pago (Pix e cartão) · <Link href="/acesso" className="hover:text-ink">Recuperar acesso</Link> · <Link href="/termos" className="hover:text-ink">Termos</Link> · <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
    </footer>
  );
}

export function accessLabel(days: number | null): string {
  if (!days) return 'Acesso pra sempre';
  if (days % 365 === 0) return days === 365 ? 'Acesso por 1 ano' : `Acesso por ${days / 365} anos`;
  if (days % 30 === 0) return days === 30 ? 'Acesso por 1 mês' : `Acesso por ${days / 30} meses`;
  return days === 1 ? 'Acesso por 1 dia' : `Acesso por ${days} dias`;
}
