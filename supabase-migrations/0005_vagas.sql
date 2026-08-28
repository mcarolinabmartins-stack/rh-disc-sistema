-- =========================================================================
-- Módulo de Vagas (recrutamento & seleção)
--
-- Pedido da Carolina (28/08/2026): abrir uma vaga e ter DOIS links públicos
-- (sem login):
--   1) token_candidatura   → candidato preenche currículo + faz o teste DISC,
--                            e o sistema calcula a aderência ao perfil da vaga.
--   2) token_preenchimento → a EMPRESA-CLIENTE preenche descrição de
--                            atividades, requisitos, salário e benefícios da
--                            própria vaga (sem poder tocar em status, no
--                            perfil DISC ideal, nem na empresa dona da vaga).
--
-- O perfil DISC ideal da vaga (disc_ideal_d/i/s/c) é uma SUGESTÃO calculada
-- no cliente (src/lib/vagaDiscSugestao.ts) a partir do texto da vaga, usando
-- o mesmo motor heurístico de CARGOS_MERCADO já existente em
-- discReportContent.ts — NUNCA é travado: a Carolina sempre pode ajustar os
-- sliders antes de publicar. Aqui no banco os quatro campos são apenas
-- numeric editável, sem nenhuma trava de "sugestão vs. valor final".
-- =========================================================================

-- =========================================================================
-- 1) VAGAS
-- =========================================================================
create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  titulo text not null,
  descricao_atividades text not null default '',
  requisitos text not null default '',
  salario text not null default '', -- texto livre: "A combinar", "R$ 3.000 a R$ 4.000", etc.
  beneficios text not null default '',
  disc_ideal_d numeric(5, 1) not null default 25,
  disc_ideal_i numeric(5, 1) not null default 25,
  disc_ideal_s numeric(5, 1) not null default 25,
  disc_ideal_c numeric(5, 1) not null default 25,
  status text not null default 'rascunho' check (status in ('rascunho', 'aberta', 'pausada', 'encerrada')),
  token_candidatura uuid not null default gen_random_uuid(),
  token_preenchimento uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_vagas_token_candidatura on public.vagas (token_candidatura);
create unique index if not exists idx_vagas_token_preenchimento on public.vagas (token_preenchimento);
create index if not exists idx_vagas_empresa on public.vagas (empresa_id, status);

-- =========================================================================
-- 2) CANDIDATOS (respostas ao link de candidatura de uma vaga)
-- =========================================================================
create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas (id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  curriculo_path text, -- caminho no bucket de storage 'curriculos' (pode ficar nulo se o upload falhar/for pulado)
  disc_norm jsonb, -- perfil DISC "atual" (média self/others), formato { D, I, S, C }
  disc_self_pct jsonb,
  disc_others_pct jsonb,
  respostas jsonb, -- respostas brutas do questionário (RespostaBloco[])
  compatibilidade_percentual numeric(5, 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_candidatos_vaga on public.candidatos (vaga_id, compatibilidade_percentual desc);

-- =========================================================================
-- 3) ROW LEVEL SECURITY
-- =========================================================================
alter table public.vagas enable row level security;
alter table public.candidatos enable row level security;

-- ---------- vagas ----------
-- RH, gestor ou admin_master com acesso à empresa da vaga têm CRUD completo.
-- Não existe política de select pública: o acesso anônimo passa só pelas
-- funções SECURITY DEFINER abaixo, localizadas por TOKEN (não pelo id).
create policy "vagas: RH/gestor/admin_master da empresa gerencia"
  on public.vagas for all
  using (public.pode_operar_empresa(empresa_id))
  with check (public.pode_operar_empresa(empresa_id));

-- ---------- candidatos ----------
-- Só leitura para quem gerencia a empresa da vaga. Não há política de
-- insert/update/delete para authenticated nem anon — a única porta de
-- entrada é a função SECURITY DEFINER submit_candidatura abaixo.
create policy "candidatos: RH/gestor/admin_master da empresa da vaga lê"
  on public.candidatos for select
  using (
    exists (
      select 1 from public.vagas v
      where v.id = candidatos.vaga_id and public.pode_operar_empresa(v.empresa_id)
    )
  );

-- =========================================================================
-- 4) FUNÇÕES PÚBLICAS (SECURITY DEFINER) — mesmo padrão de
--    0002_disc_whatsapp.sql / 0003_rh_operacional.sql: acesso mínimo
--    necessário, localizado por token (nunca por id), grant para "anon".
-- =========================================================================

-- 4.1) Dados públicos da vaga para a página de CANDIDATURA. Só retorna a
-- vaga se ela estiver com status 'aberta' — vaga em rascunho/pausada/
-- encerrada não pode receber candidaturas.
create or replace function public.get_vaga_publica_candidatura(p_token uuid)
returns table (
  id uuid,
  titulo text,
  descricao_atividades text,
  requisitos text,
  salario text,
  beneficios text,
  disc_ideal_d numeric,
  disc_ideal_i numeric,
  disc_ideal_s numeric,
  disc_ideal_c numeric,
  status text
)
language sql
security definer set search_path = public
stable
as $$
  select v.id, v.titulo, v.descricao_atividades, v.requisitos, v.salario, v.beneficios,
         v.disc_ideal_d, v.disc_ideal_i, v.disc_ideal_s, v.disc_ideal_c, v.status
  from public.vagas v
  where v.token_candidatura = p_token and v.status = 'aberta';
$$;

grant execute on function public.get_vaga_publica_candidatura(uuid) to anon;

-- 4.2) Grava a candidatura. Calcula compatibilidade_percentual no servidor
-- (não confia no valor calculado no cliente), com a MESMA fórmula de
-- distância euclidiana normalizada já usada em compatibilityWithCargo()
-- (src/data/discWords.ts) e compararCargoMercado() (discReportContent.ts):
-- distância euclidiana entre o perfil do candidato e o disc_ideal da vaga,
-- normalizada pela distância máxima possível (sqrt(4 * 100^2) = 200).
create or replace function public.submit_candidatura(
  p_token uuid,
  p_nome text,
  p_telefone text,
  p_email text,
  p_curriculo_path text,
  p_disc_norm jsonb,
  p_disc_self_pct jsonb,
  p_disc_others_pct jsonb,
  p_respostas jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_vaga record;
  v_id uuid;
  v_dist numeric;
  v_compat numeric;
begin
  select id, disc_ideal_d, disc_ideal_i, disc_ideal_s, disc_ideal_c
  into v_vaga
  from public.vagas
  where token_candidatura = p_token and status = 'aberta';

  if v_vaga.id is null then
    raise exception 'vaga inválida, encerrada ou link expirado';
  end if;

  v_dist := sqrt(
    power(coalesce((p_disc_norm ->> 'D')::numeric, 0) - v_vaga.disc_ideal_d, 2) +
    power(coalesce((p_disc_norm ->> 'I')::numeric, 0) - v_vaga.disc_ideal_i, 2) +
    power(coalesce((p_disc_norm ->> 'S')::numeric, 0) - v_vaga.disc_ideal_s, 2) +
    power(coalesce((p_disc_norm ->> 'C')::numeric, 0) - v_vaga.disc_ideal_c, 2)
  );
  v_compat := greatest(0, round(100 - (v_dist / 200) * 100));

  insert into public.candidatos (
    vaga_id, nome, telefone, email, curriculo_path,
    disc_norm, disc_self_pct, disc_others_pct, respostas, compatibilidade_percentual
  ) values (
    v_vaga.id, p_nome, p_telefone, p_email, p_curriculo_path,
    p_disc_norm, p_disc_self_pct, p_disc_others_pct, p_respostas, v_compat
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_candidatura(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb) to anon;

-- 4.3) Dados públicos da vaga para a página de PREENCHIMENTO pela
-- empresa-cliente (mostra os valores atuais para edição). Diferente da
-- candidatura, funciona em qualquer status (a empresa-cliente pode
-- preencher a vaga antes de a Carolina publicá-la como 'aberta').
create or replace function public.get_vaga_publica_preenchimento(p_token uuid)
returns table (
  titulo text,
  descricao_atividades text,
  requisitos text,
  salario text,
  beneficios text,
  status text
)
language sql
security definer set search_path = public
stable
as $$
  select v.titulo, v.descricao_atividades, v.requisitos, v.salario, v.beneficios, v.status
  from public.vagas v
  where v.token_preenchimento = p_token;
$$;

grant execute on function public.get_vaga_publica_preenchimento(uuid) to anon;

-- 4.4) Grava o preenchimento feito pela empresa-cliente. Só toca nos 4
-- campos de conteúdo — NÃO altera disc_ideal_*, status, empresa_id nem
-- qualquer token, mesmo que valores adicionais sejam enviados na chamada.
create or replace function public.submit_preenchimento_vaga(
  p_token uuid,
  p_descricao_atividades text,
  p_requisitos text,
  p_salario text,
  p_beneficios text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.vagas where token_preenchimento = p_token) then
    raise exception 'link inválido';
  end if;

  update public.vagas
  set descricao_atividades = p_descricao_atividades,
      requisitos = p_requisitos,
      salario = p_salario,
      beneficios = p_beneficios
  where token_preenchimento = p_token;
end;
$$;

grant execute on function public.submit_preenchimento_vaga(uuid, text, text, text, text) to anon;

-- =========================================================================
-- 5) STORAGE — bucket 'curriculos' (privado) para upload de currículo pelo
--    candidato, no caminho vagas/{vaga_id}/{arquivo}.
--
-- Se o seu projeto Supabase já gerencia buckets fora de migrations SQL (ex.:
-- criados manualmente pelo dashboard), o bloco abaixo é redundante mas
-- inofensivo (on conflict do nothing / create policy protegido por
-- exception). Caso a extensão "storage" não esteja disponível neste
-- ambiente de migration, comente este bloco e crie manualmente pelo painel
-- do Supabase: Storage → New bucket "curriculos" (privado) → Policies:
--   INSERT para "anon"  → bucket_id = 'curriculos'
--   SELECT para "authenticated" → bucket_id = 'curriculos' AND o usuário
--     tem acesso (via pode_operar_empresa) à empresa da vaga cujo id é o
--     segundo segmento do caminho do objeto (vagas/{vaga_id}/...).
-- O app (VagasPage/VagaCandidaturaPublicaPage) já degrada graciosamente
-- (pula o upload, mas envia o resto da candidatura) se o bucket não existir.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('curriculos', 'curriculos', false)
on conflict (id) do nothing;

drop policy if exists "curriculos: anon pode enviar currículo" on storage.objects;
create policy "curriculos: anon pode enviar currículo"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'curriculos');

drop policy if exists "curriculos: usuários da empresa da vaga podem baixar" on storage.objects;
create policy "curriculos: usuários da empresa da vaga podem baixar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'curriculos'
    and exists (
      select 1 from public.vagas v
      where v.id::text = (storage.foldername(name)) [2]
        and public.pode_operar_empresa(v.empresa_id)
    )
  );
