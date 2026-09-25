'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Lembra o comprador de guardar o link: é a única chave do acesso. */
export function SaveLink({ compact }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <div className={compact ? 'mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted' : 'mt-4 rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-muted'}>
      <span>Guarde este link: é por ele que você volta pro seu acesso.</span>{' '}
      <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-[11.5px] text-ink hover:bg-raised">
        {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar link'}
      </button>
    </div>
  );
}
