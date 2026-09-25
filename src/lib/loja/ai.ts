import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, Product, Store } from './db';

// IA vendida na loja: fala como o criador e responde com o material que ele subiu.
// Sonnet 5 por padrão (bom e barato pra conversa); LOJA_AI_MODEL troca.

const MODEL = process.env.LOJA_AI_MODEL || 'claude-sonnet-5';
export const MAX_USER_MESSAGE = 2000;

export function systemPrompt(store: Pick<Store, 'name'>, product: Pick<Product, 'title' | 'kind' | 'ai_instructions' | 'ai_knowledge'>): string {
  const role = product.kind === 'curso'
    ? `Você é o tira-dúvidas do curso "${product.title}", de ${store.name}.`
    : `Você é a IA de ${store.name}, vendida como "${product.title}".`;
  return [
    role,
    'Responda sempre em português do Brasil, a menos que a pessoa escreva em outra língua.',
    'Fale como o criador fala, usando o material abaixo como fonte principal. Se o material não cobre a pergunta, diga isso com sinceridade e responda com bom senso, sem inventar fatos, números ou histórias do criador.',
    'Você é uma IA, não o criador em pessoa: se perguntarem, diga que é a IA dele. Não prometa encontros, respostas pessoais, reembolsos ou nada em nome do criador.',
    'Não dê orientação médica, jurídica ou financeira individual: sugira procurar um profissional.',
    'Respostas curtas e diretas (até uns 3 parágrafos), a menos que peçam mais.',
    product.ai_instructions ? `\n<instrucoes_do_criador>\n${product.ai_instructions}\n</instrucoes_do_criador>` : '',
    product.ai_knowledge ? `\n<material_do_criador>\n${product.ai_knowledge}\n</material_do_criador>` : '',
  ].filter(Boolean).join('\n');
}

/** Só o texto da resposta (com thinking o primeiro bloco pode não ser texto). */
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
}

export async function reply(system: string, history: ChatMessage[], message: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada.');
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    // o material do criador é igual em toda conversa: cache corta custo e tempo
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [...history, { role: 'user', content: message }],
  });
  if (msg.stop_reason === 'refusal') return 'Não posso ajudar com isso. Quer perguntar outra coisa?';
  return extractText(msg.content).trim() || 'Não consegui responder agora. Tenta de novo?';
}
