'use client';

import { useActionState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { recoverAccessAction } from './actions';

const input = 'w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-accent-ink focus:outline-none';

export function RecoverForm() {
  const [state, action, pending] = useActionState(recoverAccessAction, {});

  if (state.ok) {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-ok" aria-hidden />
        <h2 className="mt-3 font-display text-[20px] font-bold">Confira seu e-mail</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-ink-2 text-pretty">Se esse e-mail tiver compras no prazo, os links chegam em instantes. Olhe também a caixa de spam e a aba Promoções.</p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5">
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-2">E-mail usado na compra</span>
        <input name="email" type="email" required autoComplete="email" maxLength={254} className={input} placeholder="voce@email.com" />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-crit/12 px-3 py-2 text-[13px] text-crit">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mandar meus links
      </Button>
    </form>
  );
}
