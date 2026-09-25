import type { Metadata } from 'next';
import { emailConfigured } from '@/lib/loja/email';
import { Shell, StoreFooter } from '@/components/loja/ui';
import { RecoverForm } from './RecoverForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: { absolute: 'Recuperar meu acesso' }, robots: { index: false, follow: false } };

/** Quem perdeu o link de acesso pede de novo pelo e-mail da compra. */
export default function RecoverPage() {
  return (
    <Shell narrow>
      <h1 className="font-display text-[28px] font-bold leading-tight text-balance">Recuperar meu acesso</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2 text-pretty">
        Digite o e-mail que você usou na compra. A gente manda de novo o link de tudo o que você comprou e ainda está no prazo.
      </p>
      {emailConfigured() ? <RecoverForm /> : (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5 text-[14.5px] text-ink-2">
          O envio por e-mail ainda não está ativo. Fale com o criador da loja em que você comprou: o link do seu acesso aparece no painel da loja.
        </p>
      )}
      <StoreFooter />
    </Shell>
  );
}
