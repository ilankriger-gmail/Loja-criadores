'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent-ink" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

/** Só aceita caminho interno (evita mandar a pessoa pra outro site depois do login). */
function safeNext(v: string | null): string {
  return v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/vender';
}

const input = 'w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-accent-ink focus:outline-none';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'crit'; text: string } | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const next = safeNext(useSearchParams().get('redirectTo'));
  const supabase = createClient();
  const callback = () => `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        setMessage({ tone: 'ok', text: 'Confira seu e-mail para confirmar o cadastro.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
      }
    } catch (err) {
      setMessage({ tone: 'crit', text: err instanceof Error ? err.message : 'Não deu certo. Tente de novo.' });
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (error) { setMessage({ tone: 'crit', text: error.message }); setLoading(false); }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-[28px] font-bold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="mt-1 text-center text-[14px] text-muted">Pra abrir e cuidar da sua loja.</p>
        <Button type="button" variant="outline" size="lg" className="mt-6 w-full" onClick={google} disabled={loading}>Continuar com Google</Button>
        <div className="my-5 flex items-center gap-3 font-mono text-[11px] text-faint"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
        <form onSubmit={submit} className="space-y-3">
          <input className={input} type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
          <input className={input} type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Senha (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Senha" />
          {message && <p role="alert" className={message.tone === 'ok' ? 'rounded-lg bg-ok/12 px-3 py-2 text-[13px] text-ok' : 'rounded-lg bg-crit/12 px-3 py-2 text-[13px] text-crit'}>{message.text}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null); }} className="mt-4 w-full text-center text-[13.5px] text-muted hover:text-ink">
          {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </main>
  );
}
