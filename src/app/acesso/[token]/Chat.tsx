'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

/** Conversa com a IA do produto. Cada envio gasta uma mensagem do saldo do acesso. */
export function Chat({ token, storeName, initial, remaining: initialRemaining, tutor }: { token: string; storeName: string; initial: Msg[]; remaining: number; tutor: boolean }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/loja/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, message: text }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'A IA não respondeu.');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
    } catch (err) {
      setError((err as Error).message);
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface" aria-label="Conversa com a IA">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold"><Bot className="h-5 w-5 text-accent-ink" />{tutor ? 'Tire suas dúvidas' : `IA de ${storeName}`}</h2>
        <span className="font-mono text-[11px] text-muted">{remaining} {remaining === 1 ? 'mensagem' : 'mensagens'}</span>
      </header>
      <div className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-8 text-center text-[14px] text-muted">{tutor ? 'Pergunte qualquer coisa sobre as aulas.' : `Mande sua primeira mensagem pra IA de ${storeName}.`}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed', m.role === 'user' ? 'ml-auto bg-accent text-white' : 'prose-loja bg-raised text-ink-2')}>
            {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : <p className="whitespace-pre-wrap">{m.content}</p>}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-[13px] text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Escrevendo…</div>}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="mx-4 mb-2 rounded-lg bg-crit/12 px-3 py-2 text-[13px] text-crit">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <label htmlFor="loja-chat" className="sr-only">Sua mensagem</label>
        <textarea id="loja-chat" value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={2000} disabled={remaining <= 0}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder={remaining > 0 ? 'Escreva aqui…' : 'Você usou todas as mensagens deste acesso.'}
          className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-accent-ink focus:outline-none" />
        <button type="submit" disabled={loading || !input.trim() || remaining <= 0} aria-label="Enviar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-[#c21f1f] disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
