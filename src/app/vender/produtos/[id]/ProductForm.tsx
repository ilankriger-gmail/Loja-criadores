'use client';

import { useActionState, useState } from 'react';
import { ArrowDown, ArrowUp, Bot, Download, Loader2, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/loja/db';
import { KIND_HINT, KIND_LABEL, PRODUCT_KINDS, slugify, type ProductKind } from '@/lib/loja/rules';
import { saveProductAction } from '../../actions';
import { Field, FormMessage, inputCls } from '../../forms';

type LessonDraft = { title: string; video_url: string; body: string };
const KIND_ICON = { ia: Bot, curso: PlayCircle, download: Download } as const;

export function ProductForm({ product, lessons: initialLessons, storeUrl }: { product: Product | null; lessons: LessonDraft[]; storeUrl: string }) {
  const [state, action, pending] = useActionState(saveProductAction, {});
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? 'ia');
  const [title, setTitle] = useState(product?.title ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [aiOn, setAiOn] = useState(product?.ai_enabled ?? true);
  const [lessons, setLessons] = useState<LessonDraft[]>(initialLessons.length ? initialLessons : [{ title: '', video_url: '', body: '' }]);
  const ai = kind === 'ia' || aiOn;

  const setLesson = (i: number, patch: Partial<LessonDraft>) => setLessons((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => setLessons((ls) => {
    const j = i + d;
    if (j < 0 || j >= ls.length) return ls;
    const next = [...ls];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  return (
    <form action={action} className="mt-6 space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="lessons" value={JSON.stringify(lessons)} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">O que você vai vender?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRODUCT_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={cn('rounded-xl border p-3 text-left transition-colors', kind === k ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}>
                <Icon className={cn('h-5 w-5', kind === k ? 'text-accent-ink' : 'text-muted')} />
                <p className="mt-2 font-medium">{KIND_LABEL[k]}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{KIND_HINT[k]}</p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="eyebrow">Página de venda</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do produto">
            <input name="title" required maxLength={120} value={title} className={inputCls}
              onChange={(e) => { const v = e.target.value; if (!product && slugify(title) === slug) setSlug(slugify(v)); setTitle(v); }}
              placeholder={kind === 'ia' ? 'Ex.: Converse com a minha IA' : kind === 'curso' ? 'Ex.: Como viralizar no Reels' : 'Ex.: Planilha de roteiros'} />
          </Field>
          <Field label="Endereço" hint={`${storeUrl.replace(/^https?:\/\//, '')}/${slug || '…'}`}>
            <input name="slug" maxLength={40} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className={inputCls} />
          </Field>
        </div>
        <Field label="Frase de venda" hint="Uma linha: o que a pessoa ganha.">
          <input name="headline" maxLength={200} defaultValue={product?.headline ?? ''} className={inputCls} />
        </Field>
        <Field label="Descrição" hint="Aceita markdown: **negrito**, listas com -.">
          <textarea name="description" rows={6} maxLength={8000} defaultValue={product?.description ?? ''} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preço (R$)"><input name="price" required inputMode="decimal" defaultValue={product ? (product.price_cents / 100).toFixed(2).replace('.', ',') : ''} className={inputCls} placeholder="97,00" /></Field>
          <Field label="Dias de acesso" hint="Vazio = pra sempre."><input name="access_days" type="number" min={1} max={3650} defaultValue={product?.access_days ?? (kind === 'ia' ? 30 : '')} className={inputCls} /></Field>
        </div>
      </section>

      {kind === 'curso' && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="eyebrow">Aulas</h2>
          <p className="text-[12.5px] text-muted">Cole o link do vídeo (YouTube não listado, Vimeo, Bunny ou Loom). O vídeo aparece dentro da página do aluno.</p>
          {lessons.map((l, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line bg-raised/40 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <input aria-label={`Título da aula ${i + 1}`} value={l.title} onChange={(e) => setLesson(i, { title: e.target.value })} maxLength={200} className={inputCls} placeholder="Título da aula" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded p-1.5 text-muted hover:text-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === lessons.length - 1} aria-label="Descer" className="rounded p-1.5 text-muted hover:text-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setLessons((ls) => ls.filter((_, j) => j !== i))} aria-label="Remover aula" className="rounded p-1.5 text-muted hover:text-crit"><Trash2 className="h-4 w-4" /></button>
              </div>
              <input aria-label={`Vídeo da aula ${i + 1}`} value={l.video_url} onChange={(e) => setLesson(i, { video_url: e.target.value })} maxLength={500} className={inputCls} placeholder="https://youtu.be/…" />
              <textarea aria-label={`Texto da aula ${i + 1}`} value={l.body} onChange={(e) => setLesson(i, { body: e.target.value })} rows={2} className={inputCls} placeholder="Resumo, links, exercício (opcional)" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLessons((ls) => [...ls, { title: '', video_url: '', body: '' }])}><Plus className="mr-1 h-4 w-4" /> Aula</Button>
        </section>
      )}

      {kind === 'download' && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="eyebrow">Arquivo</h2>
          <Field label="Link do arquivo (https)" hint="Google Drive, Dropbox, Notion… Só quem pagou vê este link.">
            <input name="download_url" maxLength={1000} defaultValue={product?.download_url ?? ''} className={inputCls} placeholder="https://drive.google.com/…" />
          </Field>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="eyebrow">{kind === 'curso' ? 'IA tira-dúvidas' : 'Sua IA'}</h2>
          {kind !== 'ia' && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" name="ai_enabled" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} className="accent-[#dc2626]" /> Incluir IA
            </label>
          )}
        </div>
        {/* campos ficam montados mesmo sem IA: desligar e religar não apaga o material */}
        <div className={cn('space-y-3', !ai && 'hidden')}>
            <Field label="Como a IA deve falar" hint="Seu jeito, gírias, o que ela nunca deve dizer, como encerrar a conversa.">
              <textarea name="ai_instructions" rows={4} maxLength={8000} defaultValue={product?.ai_instructions ?? ''} className={inputCls}
                placeholder="Ex.: Fala informal, com energia, trata a pessoa por 'você'. Sempre puxa pra ação: 'bora gravar hoje?'" />
            </Field>
            <Field label="Seu material" hint="Cole roteiros, transcrições dos vídeos, seu método, perguntas frequentes. Quanto mais, melhor (até 300 mil caracteres).">
              <textarea name="ai_knowledge" rows={10} defaultValue={product?.ai_knowledge ?? ''} className={cn(inputCls, 'font-mono text-[12.5px]')} />
            </Field>
            <Field label="Mensagens por compra" hint="Limite de perguntas que cada comprador pode fazer (controla o custo da IA).">
              <input name="ai_messages_limit" type="number" min={1} max={100000} defaultValue={product?.ai_messages_limit ?? 200} className={cn(inputCls, 'max-w-40')} />
            </Field>
        </div>
        {!ai && <p className="text-[13px] text-muted">Sem IA neste produto.</p>}
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="eyebrow">Depois da compra</h2>
        <Field label="Mensagem de boas-vindas" hint="Aparece no topo da página do comprador. Aceita markdown.">
          <textarea name="welcome" rows={3} maxLength={2000} defaultValue={product?.welcome ?? ''} className={inputCls} placeholder="Valeu demais por comprar! Começa pela aula 1…" />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" name="published" defaultChecked={product?.published ?? false} className="accent-[#dc2626]" /> Publicado na loja
        </label>
        <div className="flex-1"><FormMessage state={state} /></div>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar produto</Button>
      </div>
    </form>
  );
}
