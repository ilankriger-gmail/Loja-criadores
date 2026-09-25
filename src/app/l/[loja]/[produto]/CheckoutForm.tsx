'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const input = 'w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-accent-ink focus:outline-none';

function noSubscribe() { return () => {}; }

function savedAccess(store: string, product: string): string | null {
  try {
    const saved = localStorage.getItem(`loja:${store}:${product}`);
    return saved && saved.startsWith(`${window.location.origin}/acesso/`) ? saved : null;
  } catch { return null; }
}

/** Nome, e-mail e aceite dos termos → pedido criado → Checkout Pro do Mercado Pago. */
export function CheckoutForm({ store, product }: { store: string; product: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // quem já comprou neste aparelho vê o atalho pro próprio acesso
  const previous = useSyncExternalStore(noSubscribe, () => savedAccess(store, product), () => null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/loja/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, product, email, name, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Não consegui abrir o pagamento.');
      // guarda o link de acesso neste aparelho, caso a pessoa feche a aba no meio do Pix
      try { localStorage.setItem(`loja:${store}:${product}`, data.access_url); } catch {}
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-2">Seu nome</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Como quer ser chamado" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-2">Seu e-mail</span>
        <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="voce@email.com" />
      </label>
      <label className="flex items-start gap-2 text-[12.5px] leading-snug text-muted">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#dc2626]" />
        <span>Li e aceito os <Link href="/termos" target="_blank" className="underline hover:text-ink">termos</Link> e a <Link href="/privacidade" target="_blank" className="underline hover:text-ink">política de privacidade</Link>. Meu nome e e-mail vão para o criador para liberar o acesso.</span>
      </label>
      {error && <p role="alert" className="rounded-lg bg-crit/12 px-3 py-2 text-[13px] text-crit">{error}</p>}
      <Button type="submit" size="lg" className="w-full gap-2" disabled={loading || !consent}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {loading ? 'Abrindo o pagamento…' : 'Comprar com Pix ou cartão'}
      </Button>
      <p className="text-center font-mono text-[11px] text-faint">Você volta pra cá com o seu link de acesso.</p>
      {previous
        ? <a href={previous} className="block text-center text-[13px] text-accent-ink underline">Já comprou neste aparelho? Abrir meu acesso</a>
        : <Link href="/acesso" className="block text-center text-[13px] text-muted underline hover:text-ink">Já comprou? Receber meu link de novo</Link>}
    </form>
  );
}
