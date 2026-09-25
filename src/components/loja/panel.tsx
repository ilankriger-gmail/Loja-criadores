import { cn } from '@/lib/utils';

// Peças do painel do vendedor (renderizam no servidor, sem estado).
// Estado sempre com forma + cor: ● crítico · ▲ atenção · ✓ ok · ○ info.

export function PageHeader({ title, sub, right, crumb }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; crumb?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        {crumb && <div className="font-mono text-xs text-muted mb-1">{crumb}</div>}
        <h1 className="font-display text-[26px] sm:text-[30px] font-bold leading-tight text-ink text-balance">{title}</h1>
        {sub && <div className="mt-1 font-mono text-[12.5px] text-muted">{sub}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-line bg-surface p-4', className)}>{children}</section>;
}

export function CardHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="eyebrow">{title}</h2>
      {right && <div className="font-mono text-[11px] text-muted">{right}</div>}
    </div>
  );
}

export type StateTone = 'crit' | 'warn' | 'ok' | 'info';
const STATE_LABEL: Record<StateTone, string> = { crit: 'crítico', warn: 'atenção', ok: 'ok', info: 'info' };

function StateMark({ tone }: { tone: StateTone }) {
  const color = tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-info';
  return (
    <svg viewBox="0 0 10 10" className={cn('w-2.5 h-2.5 shrink-0', color)} aria-hidden>
      {tone === 'crit' && <circle cx="5" cy="5" r="4" fill="currentColor" />}
      {tone === 'warn' && <path d="M5 .8 9.5 9H.5z" fill="currentColor" />}
      {tone === 'ok' && <path d="M1.2 5.3 4 8l4.8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {tone === 'info' && <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
}

export function StateChip({ tone, children }: { tone: StateTone; children?: React.ReactNode }) {
  const bg = tone === 'crit' ? 'bg-crit/12 text-crit' : tone === 'warn' ? 'bg-warn/12 text-warn' : tone === 'ok' ? 'bg-ok/12 text-ok' : 'bg-info/12 text-info';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap', bg)}>
      <StateMark tone={tone} />
      {children ?? STATE_LABEL[tone]}
    </span>
  );
}
