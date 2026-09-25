# Loja de Criadores

Criador abre uma loja (um link só pra bio) e vende pro público dele: **IA personalizada**, **curso** e
**material pra baixar**. Pix e cartão pelo Mercado Pago (marketplace: o dinheiro cai na conta do
criador, a plataforma fica com a taxa). Tudo em português.

Next.js 16 + React 19 + Tailwind 4 + Supabase + Claude. Configuração e arquitetura: [`docs/LOJA.md`](docs/LOJA.md).

```bash
npm install
cp .env.example .env.local   # preencher
npm run dev                  # http://localhost:3000
npm test && npm run lint && npm run build
```
