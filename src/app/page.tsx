import Link from 'next/link';
import { Bot, Download, PlayCircle, QrCode } from 'lucide-react';

const FEATURES = [
  { icon: Bot, title: 'IA com o seu jeito', text: 'Seu público conversa com uma IA que fala como você e responde com o seu material: roteiros, transcrições, método.' },
  { icon: PlayCircle, title: 'Curso', text: 'Aulas em vídeo (YouTube não listado, Vimeo, Bunny, Loom) liberadas depois da compra, com IA tira-dúvidas.' },
  { icon: Download, title: 'Material pra baixar', text: 'PDF, planilha, presets: o link só aparece pra quem pagou.' },
  { icon: QrCode, title: 'Pix e cartão', text: 'Checkout do Mercado Pago em português. O dinheiro cai direto na sua conta; a plataforma fica com 5%.' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-16 sm:px-6">
      <p className="eyebrow">Loja de Criadores</p>
      <h1 className="mt-3 font-display text-[40px] font-bold leading-[1.05] text-balance sm:text-[56px]">Venda o que você sabe pro seu público. Em português.</h1>
      <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-ink-2 text-pretty">Um link só pra bio com a sua IA, o seu curso e os seus materiais. Seu fã paga com Pix ou cartão e entra na hora.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/vender" className="rounded-lg bg-accent px-6 py-3 text-base font-medium text-white hover:bg-[#c21f1f]">Criar minha loja</Link>
        <Link href="/login" className="rounded-lg border border-white/20 px-6 py-3 text-base font-medium hover:bg-white/10">Entrar</Link>
      </div>
      <section className="mt-16 grid gap-4 sm:grid-cols-2" aria-label="O que dá pra vender">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-surface p-5">
            <f.icon className="h-6 w-6 text-accent-ink" aria-hidden />
            <h2 className="mt-3 font-display text-[19px] font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="mt-16 border-t border-line pt-6 font-mono text-[11.5px] text-faint">
        <Link href="/termos" className="hover:text-ink">Termos</Link> · <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
      </footer>
    </main>
  );
}
