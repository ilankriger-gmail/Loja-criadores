-- Aviso de segurança do Supabase (function_search_path_mutable): a função que gasta mensagem
-- da IA passa a ter search_path fixo. Já aplicado no projeto loja-criadores em 25/09/2026.
alter function public.loja_use_message(uuid, int) set search_path = '';
