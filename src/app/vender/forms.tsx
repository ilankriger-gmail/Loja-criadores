'use client';

import { useActionState, useState, useTransition } from 'react';
import { Check, Copy, Loader2, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  deleteProductAction, disconnectMpAction, giftAction, grantOrderAction, resendAccessEmailAction, saveStoreAction, type FormState,
} from './actions';

export const inputCls = 'w-full rounded-lg border border-line bg-raised px-3 py-2 text-[14.5px] text-ink placeholder:text-faint focus:border-accent-ink focus:outline-none';

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-crit/12 px-3 py-2 text-[13px] text-crit">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="rounded-lg bg-ok/12 px-3 py-2 text-[13px] text-ok">{state.message}</p>;
  return null;
}

type StoreValues = { name: string; slug: string; bio: string | null; avatar_url: string | null; instagram: string | null; support_email: string | null };

export function StoreForm({ store, site }: { store: StoreValues | null; site: string }) {
  const [state, action, pending] = useActionState(saveStoreAction, {});
  const [slug, setSlug] = useState(store?.slug ?? '');
  const host = site.replace(/^https?:\/\//, '');
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da loja"><input name="name" required maxLength={80} defaultValue={store?.name} className={inputCls} placeholder="Ex.: Ilan Kriger" /></Field>
        <Field label="Endereço" hint={`${host}/l/${slug || 'seu-nome'}`}>
          <input name="slug" maxLength={40} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className={inputCls} placeholder="seu-nome" />
        </Field>
      </div>
      <Field label="Bio (aparece no topo da loja)"><textarea name="bio" rows={2} maxLength={400} defaultValue={store?.bio ?? ''} className={inputCls} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Foto (link https)"><input name="avatar_url" maxLength={500} defaultValue={store?.avatar_url ?? ''} className={inputCls} placeholder="https://…" /></Field>
        <Field label="Instagram"><input name="instagram" maxLength={40} defaultValue={store?.instagram ?? ''} className={inputCls} placeholder="@seuperfil" /></Field>
      </div>
      <Field label="E-mail de atendimento (opcional)" hint="Aparece pro comprador na página do produto e recebe as respostas do e-mail de acesso.">
        <input name="support_email" type="email" maxLength={254} defaultValue={store?.support_email ?? ''} className={inputCls} placeholder="contato@seudominio.com" />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{store ? 'Salvar loja' : 'Criar minha loja'}</Button>
    </form>
  );
}

export function CopyButton({ text, label = 'Copiar link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-[11.5px] text-ink hover:bg-raised">
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : label}
    </button>
  );
}

export function DisconnectMp() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => { if (confirm('Desconectar o Mercado Pago? A loja para de vender até conectar de novo.')) start(async () => { await disconnectMpAction(); }); }}
      className="font-mono text-[12px] text-muted underline hover:text-ink disabled:opacity-50">Desconectar</button>
  );
}

export function DeleteProduct({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={pending} aria-label={`Apagar ${title}`}
        onClick={() => { if (confirm(`Apagar "${title}"?`)) start(async () => { const r = await deleteProductAction(id); if (r.error) setError(r.error); }); }}
        className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-crit disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
      {error && <span role="alert" className="text-[12px] text-crit">{error}</span>}
    </>
  );
}

export function GrantOrder({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => { if (confirm('Liberar o acesso deste pedido? Use quando a pessoa pagou por fora.')) start(async () => { await grantOrderAction(id); }); }}
      className="rounded-md border border-line px-2 py-1 font-mono text-[11.5px] text-ink hover:bg-raised disabled:opacity-50">Liberar</button>
  );
}

export function ResendEmail({ id, sentAt }: { id: string; sentAt: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState | null>(null);
  const when = sentAt ? new Date(sentAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <>
      <button type="button" disabled={pending} title={when ? `E-mail com o link enviado em ${when}` : 'O e-mail com o link ainda não saiu'}
        onClick={() => start(async () => setResult(await resendAccessEmailAction(id)))}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-[11.5px] text-ink hover:bg-raised disabled:opacity-50">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : result?.ok ? <Check className="h-3.5 w-3.5 text-ok" /> : <Mail className={cn('h-3.5 w-3.5', !sentAt && 'text-warn')} />}
        {result?.ok ? 'Enviado' : sentAt ? 'Reenviar' : 'Enviar'}
      </button>
      {result?.error && <span role="alert" className="text-[12px] text-crit">{result.error}</span>}
    </>
  );
}

export function GiftForm({ products }: { products: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(giftAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Produto">
          <select name="product_id" required className={inputCls} defaultValue="">
            <option value="" disabled>Escolha…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="E-mail de quem ganha"><input name="email" type="email" required maxLength={254} className={inputCls} placeholder="pessoa@email.com" /></Field>
        <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Dar acesso</Button>
      </div>
      {state.error && <FormMessage state={state} />}
      {state.ok && state.message && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ok/12 px-3 py-2 text-[13px] text-ok">
          {state.emailed ? 'Acesso criado e enviado por e-mail. O link, se quiser mandar por outro canal:' : 'Acesso criado. Mande este link pra pessoa:'} <code className="break-all font-mono text-[12px] text-ink">{state.message}</code> <CopyButton text={state.message} />
        </div>
      )}
    </form>
  );
}
