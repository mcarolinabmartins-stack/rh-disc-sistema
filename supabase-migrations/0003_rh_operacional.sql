-- =========================================================================
-- Área do RH · Operacional (eventos, treinamentos, indicadores, pesquisa
-- de clima/eNPS anônima)
--
-- Este arquivo estende o schema de 0001/0002 com:
--   1) colunas de desligamento e custo de contratação em colaboradores
--   2) eventos_rh          — férias, faltas, atestados, atrasos, banco de
--                             horas e idas ao médico, por colaborador
--   3) treinamentos_rh     — treinamentos aplicados (individuais ou
--                             gerais da empresa), com custo e carga horária
--   4) pesquisa_rodadas    — "rodadas" de pesquisa de clima/eNPS (ex.: um
--                             ciclo semestral), criadas pelo RH
--   5) pesquisa_respostas  — respostas 100% ANÔNIMAS a uma rodada
--   6) duas funções SECURITY DEFINER (grant to anon) que dão suporte ao
--      fluxo público de resposta à pesquisa, no mesmo padrão usado em
--      0002_disc_whatsapp.sql para a autoavaliação DISC.
--
-- GARANTIA DE ANONIMATO (pesquisa_respostas):
--   A tabela pesquisa_respostas NÃO possui colaborador_id, nem qualquer
--   outra coluna que identifique quem respondeu (sem e-mail, sem IP, sem
--   telefone, sem device id). O único vínculo que existe é com a RODADA
--   (rodada_id), nunca com a pessoa. O envio do link é feito manualmente
--   pelo RH via WhatsApp (botão "Enviar via WhatsApp" dentro do app, que
--   apenas abre o wa.me com uma mensagem pronta) — o sistema não guarda
--   nenhum registro de "para quem o link foi enviado" atrelado à resposta.
--   Além disso, não existe política de insert/update/delete para usuários
--   autenticados nessa tabela: a única porta de entrada é a função
--   SECURITY DEFINER submit_pesquisa_publica, chamada pela página pública
--   anônima (sem login), que grava apenas rodada_id + respostas (jsonb).
-- =========================================================================

-- =========================================================================
-- 1) COLABORADORES — dados de desligamento e custo de contratação
-- =========================================================================
alter table public.colaboradores add column if not exists data_desligamento date;
alter table public.colaboradores add column if not exists motivo_desligamento text;
alter table public.colaboradores add column if not exists custo_contratacao numeric(12, 2);

-- =========================================================================
-- 2) EVENTOS_RH — férias, falta, atestado, atraso, banco de horas, ida ao médico
-- =========================================================================
create table if not exists public.eventos_rh (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id) on delete cascade,
  tipo text not null check (tipo in ('ferias', 'falta', 'atestado', 'atraso', 'banco_horas', 'ida_medico')),
  data_inicio date not null,
  data_fim date, -- usado em férias/atestado multi-dia
  horas numeric(6, 2), -- usado em atraso (duração), banco_horas (saldo +/-), ida_medico (duração)
  dias smallint, -- usado em falta/atestado/férias (contagem de dias inteiros)
  observacoes text not null default '',
  registrado_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_rh_colaborador on public.eventos_rh (colaborador_id, data_inicio desc);
create index if not exists idx_eventos_rh_tipo on public.eventos_rh (tipo, data_inicio desc);

-- =========================================================================
-- 3) TREINAMENTOS_RH — treinamentos aplicados (colaborador_id nulo = geral)
-- =========================================================================
create table if not exists public.treinamentos_rh (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references public.colaboradores (id) on delete cascade, -- null = treinamento geral da empresa
  nome_treinamento text not null,
  custo numeric(12, 2) not null default 0,
  carga_horaria numeric(6, 2),
  data date not null default current_date,
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_treinamentos_colaborador on public.treinamentos_rh (colaborador_id, data desc);
create index if not exists idx_treinamentos_data on public.treinamentos_rh (data desc);

-- =========================================================================
-- 4) PESQUISA_RODADAS — ciclos de pesquisa de clima organizacional / eNPS
-- =========================================================================
create table if not exists public.pesquisa_rodadas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('clima', 'enps')),
  rotulo text not null default '', -- ex.: "2026-S1"
  pergunta_principal text not null default '',
  data_abertura date not null default current_date,
  data_fechamento date,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_pesquisa_rodadas_tipo on public.pesquisa_rodadas (tipo, data_abertura desc);

-- =========================================================================
-- 5) PESQUISA_RESPOSTAS — respostas anônimas (sem colaborador_id!)
-- =========================================================================
create table if not exists public.pesquisa_respostas (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.pesquisa_rodadas (id) on delete cascade,
  -- estrutura flexível:
  --   eNPS  -> { "nota": 0-10, "comentario": "..." }
  --   clima -> { "scores": { "dimensao": nota, ... }, "comentario": "..." }
  respostas jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pesquisa_respostas_rodada on public.pesquisa_respostas (rodada_id);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table public.eventos_rh enable row level security;
alter table public.treinamentos_rh enable row level security;
alter table public.pesquisa_rodadas enable row level security;
alter table public.pesquisa_respostas enable row level security;

-- ---------- eventos_rh ----------
-- RH vê/edita tudo; gestor vê/insere/edita só para colaboradores da sua equipe
create policy "eventos_rh: RH vê tudo, gestor vê da sua equipe"
  on public.eventos_rh for select
  using (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "eventos_rh: RH ou gestor da equipe insere"
  on public.eventos_rh for insert
  with check (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "eventos_rh: RH ou gestor da equipe atualiza"
  on public.eventos_rh for update
  using (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "eventos_rh: só RH exclui"
  on public.eventos_rh for delete
  using (public.is_rh());

-- ---------- treinamentos_rh ----------
-- RH vê/edita tudo. Todos autenticados podem ver treinamentos gerais da
-- empresa (colaborador_id is null) e, além disso, gestor vê os da sua equipe.
create policy "treinamentos_rh: RH vê tudo, gestor vê da equipe, todos veem gerais"
  on public.treinamentos_rh for select
  using (
    public.is_rh()
    or colaborador_id is null
    or exists (
      select 1 from public.colaboradores c
      where c.id = treinamentos_rh.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "treinamentos_rh: RH ou gestor da equipe insere"
  on public.treinamentos_rh for insert
  with check (
    public.is_rh()
    or (
      colaborador_id is not null
      and exists (
        select 1 from public.colaboradores c
        where c.id = treinamentos_rh.colaborador_id and c.gestor_id = auth.uid()
      )
    )
  );

create policy "treinamentos_rh: só RH atualiza"
  on public.treinamentos_rh for update
  using (public.is_rh());

create policy "treinamentos_rh: só RH exclui"
  on public.treinamentos_rh for delete
  using (public.is_rh());

-- ---------- pesquisa_rodadas ----------
-- RH tem CRUD completo. Todos autenticados podem ler rodadas ativas
-- (necessário para montar os links de envio por WhatsApp).
create policy "pesquisa_rodadas: RH vê tudo"
  on public.pesquisa_rodadas for select
  using (public.is_rh() or ativo = true);

create policy "pesquisa_rodadas: só RH cria"
  on public.pesquisa_rodadas for insert
  with check (public.is_rh());

create policy "pesquisa_rodadas: só RH atualiza"
  on public.pesquisa_rodadas for update
  using (public.is_rh());

create policy "pesquisa_rodadas: só RH exclui"
  on public.pesquisa_rodadas for delete
  using (public.is_rh());

-- ---------- pesquisa_respostas ----------
-- Só RH pode LER as respostas agregadas (nunca há coluna de identificação
-- de colaborador para "ler"). NÃO existe política de insert/update/delete
-- para usuários autenticados: a única forma de gravar uma resposta é via
-- a função SECURITY DEFINER submit_pesquisa_publica (usada pela página
-- pública, sem login), o que impede até o próprio RH de inserir uma
-- resposta "em nome de" alguém pela API normal.
create policy "pesquisa_respostas: só RH lê (agregado, nunca por pessoa)"
  on public.pesquisa_respostas for select
  using (public.is_rh());

-- =========================================================================
-- FUNÇÕES PÚBLICAS (SECURITY DEFINER) — fluxo anônimo da pesquisa
-- Mesmo padrão de 0002_disc_whatsapp.sql: acesso mínimo necessário,
-- grant execute para o papel "anon" (sem login).
-- =========================================================================

-- Carrega apenas os metadados da rodada, para a página pública renderizar
-- o formulário certo (tipo clima ou enps) e a pergunta principal.
create or replace function public.get_rodada_pesquisa_publica(p_rodada_id uuid)
returns table (
  tipo text,
  rotulo text,
  pergunta_principal text,
  ativo boolean
)
language sql
security definer set search_path = public
stable
as $$
  select r.tipo, r.rotulo, r.pergunta_principal, r.ativo
  from public.pesquisa_rodadas r
  where r.id = p_rodada_id;
$$;

grant execute on function public.get_rodada_pesquisa_publica(uuid) to anon;

-- Grava a resposta anônima. Só aceita rodadas ativas. Não recebe, e
-- portanto não pode gravar, nenhum identificador do respondente.
create or replace function public.submit_pesquisa_publica(
  p_rodada_id uuid,
  p_respostas jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.pesquisa_rodadas where id = p_rodada_id and ativo = true) then
    raise exception 'rodada de pesquisa inválida ou encerrada';
  end if;

  insert into public.pesquisa_respostas (rodada_id, respostas)
  values (p_rodada_id, p_respostas)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_pesquisa_publica(uuid, jsonb) to anon;
