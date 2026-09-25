import type { Metadata } from 'next';

export const metadata: Metadata = { title: { absolute: 'Termos de uso da Loja' }, robots: { index: true, follow: true } };

// Texto base: revisar com o jurídico antes de abrir a loja ao público.
export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink-2 sm:px-6">
      <h1 className="font-display text-[30px] font-bold text-ink">Termos de uso da Loja</h1>
      <p className="mt-1 font-mono text-[12px] text-muted">Atualizado em 25 de setembro de 2026</p>
      <div className="prose-loja mt-8 space-y-6 text-[15px] leading-relaxed">
        <section><h2>1. Quem vende</h2><p>Cada loja é de um criador de conteúdo independente, que é o vendedor e o responsável pelo produto, pelo atendimento e pelo conteúdo. A plataforma oferece a vitrine, o acesso e a tecnologia, e cobra do criador uma taxa por venda.</p></section>
        <section><h2>2. Pagamento</h2><p>O pagamento é processado pelo Mercado Pago (Pix, cartão ou boleto), direto para a conta do criador. A plataforma não vê nem guarda dados de cartão.</p></section>
        <section><h2>3. Acesso</h2><p>Depois do pagamento aprovado você recebe um link pessoal de acesso. Quem tem o link entra: guarde-o e não compartilhe. O prazo de acesso aparece na página do produto. A IA tem um limite de mensagens por compra.</p></section>
        <section><h2>4. IA personalizada</h2><p>A IA é um programa treinado com o material do criador. Ela não é o criador, pode errar e não substitui orientação profissional (médica, jurídica, financeira ou psicológica). As conversas ficam guardadas para você continuar de onde parou.</p></section>
        <section><h2>5. Arrependimento e reembolso</h2><p>Pelo Código de Defesa do Consumidor (art. 49), você pode desistir da compra em até 7 dias. Peça o reembolso ao criador pelo contato da loja ou pelo Mercado Pago. Com o reembolso, o acesso é encerrado.</p></section>
        <section><h2>6. Uso proibido</h2><p>Não é permitido revender, copiar ou distribuir o conteúdo, nem tentar extrair o material da IA em massa. O acesso pode ser encerrado em caso de abuso.</p></section>
      </div>
    </main>
  );
}
