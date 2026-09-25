import { NextRequest, NextResponse } from 'next/server';
import { appendChat, chatHistory, orderByToken, productFull, refundMessage, storeById, spendMessage } from '@/lib/loja/db';
import { looksLikeToken } from '@/lib/loja/crypto';
import { MAX_USER_MESSAGE, reply, systemPrompt } from '@/lib/loja/ai';
import { accessState } from '@/lib/loja/rules';

export const maxDuration = 60;

/** Conversa do comprador com a IA do produto. O link de acesso é a credencial. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { token?: unknown; message?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_USER_MESSAGE) : '';
  if (!looksLikeToken(token)) return NextResponse.json({ error: 'Link de acesso inválido.' }, { status: 401 });
  if (!message) return NextResponse.json({ error: 'Escreva uma mensagem.' }, { status: 400 });

  try {
    const order = await orderByToken(token);
    if (!order || !accessState(order).ok) return NextResponse.json({ error: 'Seu acesso não está ativo.' }, { status: 403 });
    const [product, store] = await Promise.all([productFull(order.product_id), storeById(order.store_id)]);
    if (!product?.ai_enabled || !store) return NextResponse.json({ error: 'Este produto não tem IA.' }, { status: 400 });
    if (!(await spendMessage(order.id, product.ai_messages_limit))) {
      return NextResponse.json({ error: 'Você usou todas as mensagens deste acesso.' }, { status: 429 });
    }
    let answer: string;
    try {
      answer = await reply(systemPrompt(store, product), await chatHistory(order.id, 20), message);
    } catch (e) {
      // a IA falhou depois de gastar o saldo: devolve a mensagem antes de avisar o comprador
      await refundMessage(order.id).catch((err) => console.error('[loja] devolver mensagem:', (err as Error).message));
      throw e;
    }
    await appendChat(order.id, [{ role: 'user', content: message }, { role: 'assistant', content: answer }]);
    return NextResponse.json({ reply: answer, remaining: Math.max(0, product.ai_messages_limit - order.messages_used - 1) });
  } catch (e) {
    console.error('[loja] chat:', (e as Error).message);
    return NextResponse.json({ error: 'A IA não respondeu agora. Tente de novo em instantes.' }, { status: 502 });
  }
}
