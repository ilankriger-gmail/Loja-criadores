-- ============================================
-- Migration: 2026-09-25 — Loja (criador vende IA, curso e download pro público dele)
-- Rodar no Supabase SQL Editor (idempotente)
--
-- Tudo é lido e gravado pelo servidor com a service role (createServiceClient):
-- RLS ligado e nenhuma policy, então a anon key não enxerga nada destas tabelas.
-- Tokens do Mercado Pago e links de acesso ficam cifrados (LOJA_ENCRYPTION_KEY).
-- ============================================

create table if not exists public.loja_stores (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  bio text,
  avatar_url text,
  instagram text,
  fee_bps int not null default 500 check (fee_bps between 0 and 5000),  -- taxa da plataforma (500 = 5%)
  mp_user_id text,
  mp_public_key text,
  mp_access_token_enc text,
  mp_refresh_token_enc text,
  mp_token_expires_at timestamptz,
  mp_connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists loja_stores_owner on public.loja_stores (owner_id);

create table if not exists public.loja_products (
  id uuid default gen_random_uuid() primary key,
  store_id uuid not null references public.loja_stores(id) on delete cascade,
  slug text not null,
  kind text not null check (kind in ('ia', 'curso', 'download')),
  title text not null,
  headline text,
  description text,
  price_cents int not null check (price_cents between 100 and 1000000),
  access_days int check (access_days is null or access_days between 1 and 3650), -- null = pra sempre
  published boolean not null default false,
  welcome text,                     -- mensagem que o comprador vê ao entrar
  ai_enabled boolean not null default false,
  ai_instructions text,             -- jeito de falar, regras
  ai_knowledge text,                -- material: roteiros, transcrições, método
  ai_messages_limit int not null default 200 check (ai_messages_limit between 1 and 100000),
  download_url text,
  position int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (store_id, slug)
);

create table if not exists public.loja_lessons (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.loja_products(id) on delete cascade,
  position int not null default 0,
  title text not null,
  video_url text,
  body text
);

create index if not exists loja_lessons_product on public.loja_lessons (product_id, position);

create table if not exists public.loja_orders (
  id uuid default gen_random_uuid() primary key,
  store_id uuid not null references public.loja_stores(id) on delete cascade,
  product_id uuid not null references public.loja_products(id) on delete restrict,
  buyer_email text not null,
  buyer_name text,
  amount_cents int not null,
  fee_cents int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  source text not null default 'mercadopago',  -- mercadopago | manual
  mp_preference_id text,
  mp_payment_id text unique,
  mp_status text,
  access_token_hash text not null unique,
  access_token_enc text not null,
  consent_at timestamptz not null,
  paid_at timestamptz,
  expires_at timestamptz,
  messages_used int not null default 0,
  created_at timestamptz default now()
);

create index if not exists loja_orders_store on public.loja_orders (store_id, created_at desc);

create table if not exists public.loja_chat_messages (
  id bigserial primary key,
  order_id uuid not null references public.loja_orders(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists loja_chat_order on public.loja_chat_messages (order_id, id);

alter table public.loja_stores enable row level security;
alter table public.loja_products enable row level security;
alter table public.loja_lessons enable row level security;
alter table public.loja_orders enable row level security;
alter table public.loja_chat_messages enable row level security;

-- Gasta uma mensagem da IA só se ainda houver saldo (atômico: dois cliques não passam do limite).
create or replace function public.loja_use_message(p_order uuid, p_limit int)
returns int language sql set search_path = '' as $$
  update public.loja_orders set messages_used = messages_used + 1
  where id = p_order and status = 'paid' and messages_used < p_limit
  returning messages_used;
$$;

revoke all on function public.loja_use_message(uuid, int) from public, anon, authenticated;
