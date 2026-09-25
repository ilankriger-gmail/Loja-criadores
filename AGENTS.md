# AGENTS.md — Loja de Criadores

- **Dono:** Ilan Kriger. Projeto separado do Creator Dashboard / Acervo Studio (nasceu lá e saiu).
- **Stack:** Next.js 16 + React 19 + Tailwind 4 + Supabase (projeto próprio) + Mercado Pago + Claude.
- **Leia primeiro:** `docs/LOJA.md` (fluxo da compra, segurança, configuração).

## Mapa
- Regras puras (testadas): `src/lib/loja/rules.ts`, `crypto.ts`, `mercadopago.ts`.
- Banco: `src/lib/loja/db.ts` (sempre service role; tabelas `loja_*` com RLS sem policy). Schema em `supabase/`.
- Painel do criador `/vender`, vitrine `/l/[loja]`, venda `/l/[loja]/[produto]`, comprador `/acesso/[token]`.

## Regras
1. Nunca push direto no `main` sem o Ilan aprovar: branches + PR.
2. `npm test`, `npm run lint` e `npm run build` passando antes de commitar.
3. Segredos só em `.env.local` / Vercel. Nunca trocar `LOJA_ENCRYPTION_KEY` depois de ter vendas.
4. Preço sempre vem do banco; acesso só é liberado depois de buscar o pagamento na API do Mercado Pago.
5. Textos da interface em português do Brasil.
