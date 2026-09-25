# Loja de Criadores

Um "Eden em português": cada criador abre uma loja (um link só pra bio) e vende pro público dele:

| Produto | O que o comprador recebe |
|---|---|
| **IA personalizada** | Chat com uma IA que fala do jeito do criador e responde com o material dele (roteiros, transcrições, método). Limite de mensagens por compra. |
| **Curso** | Aulas em vídeo (YouTube não listado, Vimeo, Bunny, Loom) + IA tira-dúvidas opcional. |
| **Download** | Link do arquivo (Drive, Dropbox, Notion), visível só depois do pagamento. |

Pagamento único (Pix, cartão em até 12x, boleto) pelo **Checkout Pro do Mercado Pago**, no modelo
**marketplace**: a venda cai direto na conta do criador e a plataforma recebe a taxa (`marketplace_fee`,
padrão 5%, `LOJA_TAXA_PERCENT`). Acesso por tempo (`access_days`) ou pra sempre.

## Telas

| Rota | Quem | O quê |
|---|---|---|
| `/vender` | qualquer pessoa logada | cria a loja, conecta o Mercado Pago, produtos, pedidos, cortesias |
| `/vender/produtos/[id\|novo]` | dono da loja | editor do produto (página de venda, aulas, IA, arquivo) |
| `/l/[loja]` | público | vitrine |
| `/l/[loja]/[produto]` | público | página de venda + checkout |
| `/acesso/[token]` | comprador | aulas, chat com a IA, download |
| `/`, `/login` | público | apresentação e login dos criadores (Google ou e-mail) |
| `/termos`, `/privacidade` | público | textos base (CDC art. 49, LGPD): **revisar com o jurídico** |

## Como funciona a compra

1. O comprador põe nome e e-mail e aceita os termos → `POST /api/loja/checkout` cria o pedido
   (`pending`) com o preço **do banco** e gera um link de acesso aleatório (32 bytes; no banco só o
   hash e uma cópia cifrada pro painel do criador).
2. A preferência do Checkout Pro é criada **com o token do criador**, `external_reference` = id do
   pedido, `marketplace_fee` = taxa, `back_urls` = `/acesso/<token>`.
3. O Mercado Pago avisa em `/api/loja/mercadopago/webhook?store=<id>`. A assinatura é conferida
   (`MERCADOPAGO_WEBHOOK_SECRET`) e, de todo jeito, o pagamento é **buscado na API** antes de liberar:
   pedido, valor e moeda precisam bater. Reembolso/chargeback encerra o acesso.
4. Na volta do checkout, `/acesso/<token>?payment_id=…` confere na hora (não depende do webhook) e
   a página se atualiza sozinha enquanto o Pix não cai.

## Configurar (uma vez)

1. Criar um projeto novo no Supabase só pra Loja e rodar os arquivos de `supabase/` em ordem no SQL Editor.
   Em *Authentication*, ligar Google (opcional) e pôr `https://SEU-DOMINIO/api/auth/callback` nas
   *Redirect URLs*.
2. Mercado Pago Developers → **Suas integrações → Criar aplicação** (Pagamentos online, Checkout Pro,
   **marketplace**). Em *URLs de redirecionamento* colocar
   `https://SEU-DOMINIO/api/loja/mercadopago/callback`.
3. Em *Webhooks*, gerar a assinatura secreta (evento **Pagamentos**).
4. Criar o projeto na Vercel apontando pra este repositório e preencher as variáveis de
   `.env.example` (Supabase novo, `LOJA_ENCRYPTION_KEY`, Mercado Pago, `ANTHROPIC_API_KEY`,
   `NEXT_PUBLIC_SITE_URL`).
5. Abrir `/vender`, criar a loja, **Conectar Mercado Pago**, criar um produto e publicar.
   Pra testar sem pagar: "Dar acesso de cortesia" gera um link de comprador.

## Segurança

- Tabelas `loja_*` com RLS ligado e **sem policy**: só o servidor (service role) lê e grava.
- Tokens do Mercado Pago e links de acesso cifrados com AES-256-GCM (`LOJA_ENCRYPTION_KEY`).
- `state` do OAuth assinado (HMAC, 15 min) e a loja precisa ser de quem está logado.
- Toda ação do painel busca a loja pelo `owner_id` de quem está logado.
- Saldo da IA gasto de forma atômica (`loja_use_message`); página de acesso com `noindex` e `no-referrer`.

## Ainda não tem

- E-mail automático com o link de acesso (hoje: o comprador volta do checkout pro link, que fica
  salvo no aparelho, e o criador pode copiar o link de cada pedido no painel e mandar).
- Assinatura mensal, cupom, afiliados, upload de arquivo/vídeo próprio, página com a cor da loja.
- Rate limit por IP no checkout.
- Mensagem da IA gasta mesmo quando a resposta falha.
