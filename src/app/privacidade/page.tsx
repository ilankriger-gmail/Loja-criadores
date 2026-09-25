import type { Metadata } from 'next';

export const metadata: Metadata = { title: { absolute: 'Privacidade na Loja' }, robots: { index: true, follow: true } };

// Texto base (LGPD): revisar com o jurídico antes de abrir a loja ao público.
export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink-2 sm:px-6">
      <h1 className="font-display text-[30px] font-bold text-ink">Política de privacidade da Loja</h1>
      <p className="mt-1 font-mono text-[12px] text-muted">Atualizado em 25 de setembro de 2026</p>
      <div className="prose-loja mt-8 space-y-6 text-[15px] leading-relaxed">
        <section><h2>O que coletamos</h2><ul><li>Nome e e-mail que você digita na compra.</li><li>Status do pagamento, informado pelo Mercado Pago (não recebemos dados do cartão).</li><li>As mensagens que você troca com a IA do produto.</li></ul></section>
        <section><h2>Para quê</h2><p>Para liberar e manter o seu acesso, para o criador saber quem comprou e poder te atender, para gerar as respostas da IA e para cumprir obrigações legais e fiscais (LGPD, art. 7º, incisos II e V).</p></section>
        <section><h2>Com quem compartilhamos</h2><p>Com o criador da loja em que você comprou, com o Mercado Pago (pagamento) e com a Anthropic, que processa as mensagens da IA. Não vendemos seus dados.</p></section>
        <section><h2>Por quanto tempo</h2><p>Enquanto o acesso estiver ativo e pelo prazo que a lei exige para registros de venda. As conversas com a IA são apagadas quando o pedido é apagado.</p></section>
        <section><h2>Seus direitos</h2><p>Você pode pedir acesso, correção ou exclusão dos seus dados, e revogar o consentimento, falando com o criador da loja ou com a plataforma pelo contato da loja.</p></section>
      </div>
    </main>
  );
}
