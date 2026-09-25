import type { ProductKind } from './rules';

// Textos dos e-mails da Loja (sem rede): testados em __tests__/email.test.ts. Nome da loja e do
// produto são escritos pelo criador, então tudo que entra no HTML passa por escapeHtml.

export interface Email { subject: string; html: string; text: string }

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Assunto numa linha só e sem passar do tamanho que os apps mostram. */
function oneLine(s: string, max = 120): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

const WHAT: Record<ProductKind, string> = {
  ia: 'conversar com a IA',
  curso: 'assistir às aulas',
  download: 'baixar o material',
};

const P = 'margin:0 0 14px;font-size:15px;line-height:1.55;color:#3f3f46';
const SMALL = 'margin:0 0 10px;font-size:13px;line-height:1.5;color:#71717a';

function layout(preheader: string, inner: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px 24px">${inner}</td></tr></table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#a1a1aa">Loja de Criadores · pagamento seguro pelo Mercado Pago</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">${escapeHtml(label)}</a></p>`;
}

export interface AccessEmailInput {
  storeName: string;
  productTitle: string;
  kind: ProductKind;
  accessUrl: string;
  expiresAt: Date | null;
  buyerName: string | null;
  supportEmail: string | null;
}

/** Enviado quando o pagamento é aprovado (ou o criador libera/dá cortesia). */
export function accessEmail(i: AccessEmailInput): Email {
  const first = i.buyerName?.trim().split(/\s+/)[0];
  const hello = first ? `Oi, ${first}!` : 'Oi!';
  const period = i.expiresAt ? `Seu acesso vale até ${formatDate(i.expiresAt)}.` : 'Seu acesso é pra sempre.';
  const help = i.supportEmail
    ? `Dúvidas? É só responder este e-mail ou escrever pra ${i.supportEmail}.`
    : `Dúvidas? Fale com ${i.storeName} pelos canais da loja.`;
  const warn = 'Guarde este e-mail e não compartilhe o link: quem tem o link entra no seu acesso.';

  const html = layout(`Seu acesso a ${i.productTitle} está liberado.`, [
    `<p style="${SMALL}">${escapeHtml(i.storeName)}</p>`,
    `<h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;color:#18181b">${escapeHtml(i.productTitle)}</h1>`,
    `<p style="${P}">${escapeHtml(hello)} Seu pagamento foi aprovado. Clique no botão pra ${WHAT[i.kind]}.</p>`,
    button(i.accessUrl, 'Abrir meu acesso'),
    `<p style="${P}">${escapeHtml(period)}</p>`,
    `<p style="${SMALL}">${escapeHtml(warn)}</p>`,
    `<p style="${SMALL}">Se o botão não abrir, copie este endereço no navegador:<br><a href="${escapeHtml(i.accessUrl)}" style="color:#dc2626;word-break:break-all">${escapeHtml(i.accessUrl)}</a></p>`,
    `<p style="${SMALL}">${escapeHtml(help)}</p>`,
  ].join('\n'));

  const text = [
    i.storeName,
    i.productTitle,
    '',
    `${hello} Seu pagamento foi aprovado. Abra o link abaixo pra ${WHAT[i.kind]}:`,
    i.accessUrl,
    '',
    period,
    warn,
    help,
  ].join('\n');

  return { subject: oneLine(`Seu acesso: ${i.productTitle}`), html, text };
}

export interface RecoveryItem { storeName: string; productTitle: string; accessUrl: string; expiresAt: Date | null }

/** "Perdi meu link": todos os acessos ativos daquele e-mail numa mensagem só. */
export function recoveryEmail(items: RecoveryItem[]): Email {
  const intro = items.length === 1 ? 'Aqui está o link do seu acesso:' : `Aqui estão os links dos seus ${items.length} acessos:`;
  const ignore = 'Alguém pediu os links de acesso deste e-mail na Loja de Criadores. Se não foi você, pode ignorar: os links só chegam aqui.';
  const until = (d: Date | null) => (d ? `até ${formatDate(d)}` : 'pra sempre');

  const rows = items.map((it) => [
    '<tr><td style="padding:14px 0;border-top:1px solid #e4e4e7">',
    `<p style="margin:0;font-size:12px;color:#71717a">${escapeHtml(it.storeName)} · acesso ${escapeHtml(until(it.expiresAt))}</p>`,
    `<p style="margin:4px 0 8px;font-size:16px;font-weight:600;color:#18181b">${escapeHtml(it.productTitle)}</p>`,
    `<a href="${escapeHtml(it.accessUrl)}" style="color:#dc2626;font-weight:600;text-decoration:none">Abrir meu acesso →</a>`,
    '</td></tr>',
  ].join('')).join('\n');

  const html = layout(intro, [
    `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#18181b">Seus links de acesso</h1>`,
    `<p style="${P}">${escapeHtml(intro)}</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
    `<p style="${SMALL};margin-top:18px">${escapeHtml(ignore)}</p>`,
  ].join('\n'));

  const text = [
    intro,
    '',
    ...items.flatMap((it) => [`${it.productTitle} (${it.storeName}, acesso ${until(it.expiresAt)})`, it.accessUrl, '']),
    ignore,
  ].join('\n');

  const subject = items.length === 1 ? oneLine(`Seu link de acesso: ${items[0].productTitle}`) : 'Seus links de acesso';
  return { subject, html, text };
}
