-- ============================================
-- Migration: 2026-09-25 — e-mail do link de acesso, limite de tentativas e devolução da mensagem da IA
-- Rodar no Supabase SQL Editor depois do 002 (idempotente). Já aplicado no projeto loja-criadores em 25/09/2026.
-- ============================================

-- E-mail de atendimento da loja: aparece pro comprador e recebe as respostas dos e-mails de acesso.
alter table public.loja_stores add column if not exists support_email text;

-- Quando o e-mail com o link de acesso saiu (null = ainda não). Marcado antes de enviar, pra
-- webhook e volta do checkout chegando juntos não mandarem dois e-mails.
alter table public.loja_orders add column if not exists access_email_sent_at timestamptz;

-- "Perdi meu link": busca as compras pelo e-mail (gravado sempre em minúsculas).
create index if not exists loja_orders_buyer on public.loja_orders (buyer_email, created_at desc);

-- Devolve a mensagem da IA quando a resposta falhou (o saldo foi gasto antes de chamar a IA).
create or replace function public.loja_refund_message(p_order uuid)
returns void language sql set search_path = '' as $$
  update public.loja_orders set messages_used = messages_used - 1
  where id = p_order and messages_used > 0;
$$;

revoke all on function public.loja_refund_message(uuid) from public, anon, authenticated;

-- Limite de tentativas (checkout, recuperar acesso) por janela fixa. A chave leva o IP ou o
-- e-mail já com hash: nada de IP em texto puro no banco.
create table if not exists public.loja_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

alter table public.loja_rate_limits enable row level security;

-- Conta uma tentativa e diz se ainda está dentro do limite (atômico: dois pedidos juntos contam dois).
create or replace function public.loja_rate_hit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_hits int;
begin
  insert into public.loja_rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  -- faxina de vez em quando: janelas com mais de um dia não servem pra nada
  if random() < 0.01 then
    delete from public.loja_rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;

revoke all on function public.loja_rate_hit(text, int, int) from public, anon, authenticated;
