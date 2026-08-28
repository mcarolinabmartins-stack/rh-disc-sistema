-- =========================================================================
-- Multiempresa (multi-tenant) · admin_master, empresas, grupos de empresas
--
-- Pedido da Carolina (28/08/2026): ela revende o sistema para várias
-- empresas-cliente e precisa de um papel acima do RH ("admin_master", ela e
-- seu time) que cria empresas, agrupa empresas em "grupos de empresas" (para
-- dar acesso a mais de uma empresa de uma vez) e decide quais usuários têm
-- acesso a qual empresa/grupo.
--
-- MODELO DE ACESSO (do mais amplo ao mais restrito):
--   admin_master  > enxerga e gerencia TODAS as empresas, sem exceção.
--   RH de empresa > enxerga/gerencia os dados da(s) empresa(s) às quais tem
--                   acesso concedido (usuario_empresas ou, indiretamente,
--                   usuario_grupos + grupo_empresas_membros).
--   gestor        > dentro da empresa, só enxerga/edita os colaboradores em
--                   que ele é o gestor (gestor_id) — restrição adicional,
--                   não substitui o escopo por empresa.
--
-- DECISÃO DELIBERADA (pedido explícito da Carolina): o modelo multiempresa
-- começa DO ZERO. Não fazemos backfill/migração automática dos dados já
-- existentes (colaboradores, cargos, avaliações etc.) para uma "empresa
-- sintética". As colunas empresa_id abaixo são NULLABLE de propósito —
-- registros antigos continuam com empresa_id = null até a Carolina revisar
-- e atribuí-los manualmente a uma empresa. Por isso as políticas de RLS
-- abaixo tratam empresa_id = null como "dado legado visível para qualquer
-- RH", exatamente como era o comportamento ANTES desta migration (não
-- queremos quebrar o acesso a dados antigos por causa da retrofit).
-- =========================================================================

-- =========================================================================
-- 1) EMPRESAS, GRUPOS DE EMPRESAS E CONCESSÕES DE ACESSO
-- =========================================================================

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.grupos_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Quais empresas compõem cada grupo (N:N).
create table if not exists public.grupo_empresas_membros (
  grupo_id uuid not null references public.grupos_empresas (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  primary key (grupo_id, empresa_id)
);

-- Concessão de acesso DIRETA de um usuário a UMA empresa, com o papel que
-- ele exerce nela (mesmos valores de profiles.role usados hoje: rh/gestor).
-- Um mesmo usuário pode ter papéis diferentes em empresas diferentes.
create table if not exists public.usuario_empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  papel text not null default 'gestor' check (papel in ('rh', 'gestor')),
  created_at timestamptz not null default now(),
  unique (user_id, empresa_id)
);

-- Concessão de acesso a um GRUPO inteiro de empresas de uma vez: o usuário
-- passa a ter acesso a toda empresa que hoje (ou no futuro) pertença ao grupo.
create table if not exists public.usuario_grupos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  grupo_id uuid not null references public.grupos_empresas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, grupo_id)
);

create index if not exists idx_usuario_empresas_user on public.usuario_empresas (user_id);
create index if not exists idx_usuario_empresas_empresa on public.usuario_empresas (empresa_id);
create index if not exists idx_usuario_grupos_user on public.usuario_grupos (user_id);
create index if not exists idx_grupo_empresas_membros_empresa on public.grupo_empresas_membros (empresa_id);

-- =========================================================================
-- 2) PAPEL admin_master EM profiles
-- =========================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('rh', 'gestor', 'admin_master'));

-- =========================================================================
-- 3) FUNÇÕES AUXILIARES (SECURITY DEFINER) — mesmo padrão de is_rh()
-- =========================================================================

create or replace function public.is_admin_master()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin_master'
  );
$$;

-- Conjunto de empresa_id que um usuário pode acessar: concessões diretas
-- (usuario_empresas) UNION empresas de qualquer grupo ao qual ele tenha
-- acesso (usuario_grupos + grupo_empresas_membros). Usada dentro de outras
-- políticas de RLS para não repetir essa lógica de UNION em cada tabela.
create or replace function public.empresas_acessiveis(p_user_id uuid)
returns setof uuid
language sql
security definer set search_path = public
stable
as $$
  select empresa_id from public.usuario_empresas where user_id = p_user_id
  union
  select gem.empresa_id
  from public.usuario_grupos ug
  join public.grupo_empresas_membros gem on gem.grupo_id = ug.grupo_id
  where ug.user_id = p_user_id;
$$;

-- Pode LER dados de uma empresa: admin_master, dado legado sem empresa
-- (empresa_id null — comportamento pré-multiempresa, propositalmente
-- mantido), ou usuário com acesso concedido àquela empresa.
create or replace function public.pode_ver_empresa(p_empresa_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin_master()
    or p_empresa_id is null
    or p_empresa_id in (select public.empresas_acessiveis(auth.uid()));
$$;

-- Pode GERENCIAR (criar/editar/excluir) dados de uma empresa como RH:
-- admin_master, ou é RH E (dado legado sem empresa OU tem acesso concedido
-- àquela empresa). Gestores NÃO passam aqui — eles usam a restrição
-- adicional gestor_id = auth.uid() em cada política, como já era antes.
create or replace function public.pode_gerenciar_empresa(p_empresa_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin_master()
    or (
      public.is_rh()
      and (p_empresa_id is null or p_empresa_id in (select public.empresas_acessiveis(auth.uid())))
    );
$$;

-- Pode OPERAR (CRUD) um recurso novo, empresa-scoped desde o início (ex.:
-- vagas), onde tanto RH quanto gestor da empresa têm acesso igual — usada
-- pelo módulo de vagas (0005_vagas.sql). Diferente de pode_gerenciar_empresa
-- porque aqui não existe fallback "empresa_id null" (vaga sempre nasce
-- vinculada a uma empresa) e o papel (rh/gestor) não distingue permissão.
create or replace function public.pode_operar_empresa(p_empresa_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin_master()
    or p_empresa_id in (select public.empresas_acessiveis(auth.uid()));
$$;

-- =========================================================================
-- 4) empresa_id NULLABLE nas tabelas existentes (sem backfill — ver nota no
--    topo do arquivo). historico_salarial, avaliacoes_disc e
--    pesquisa_respostas NÃO recebem a coluna: seu escopo de empresa é
--    derivado via join com a tabela pai (colaboradores / pesquisa_rodadas).
-- =========================================================================
alter table public.colaboradores add column if not exists empresa_id uuid references public.empresas (id);
alter table public.cargos add column if not exists empresa_id uuid references public.empresas (id);
alter table public.faixas_salariais add column if not exists empresa_id uuid references public.empresas (id);
alter table public.benchmarks_mercado add column if not exists empresa_id uuid references public.empresas (id);
alter table public.eventos_rh add column if not exists empresa_id uuid references public.empresas (id);
alter table public.treinamentos_rh add column if not exists empresa_id uuid references public.empresas (id);
alter table public.pesquisa_rodadas add column if not exists empresa_id uuid references public.empresas (id);

create index if not exists idx_colaboradores_empresa on public.colaboradores (empresa_id);
create index if not exists idx_cargos_empresa on public.cargos (empresa_id);
create index if not exists idx_faixas_empresa on public.faixas_salariais (empresa_id);
create index if not exists idx_benchmarks_empresa on public.benchmarks_mercado (empresa_id);
create index if not exists idx_eventos_rh_empresa on public.eventos_rh (empresa_id);
create index if not exists idx_treinamentos_rh_empresa on public.treinamentos_rh (empresa_id);
create index if not exists idx_pesquisa_rodadas_empresa on public.pesquisa_rodadas (empresa_id);

-- =========================================================================
-- 5) RLS — NOVAS TABELAS
-- =========================================================================
alter table public.empresas enable row level security;
alter table public.grupos_empresas enable row level security;
alter table public.grupo_empresas_membros enable row level security;
alter table public.usuario_empresas enable row level security;
alter table public.usuario_grupos enable row level security;

-- ---------- empresas ----------
create policy "empresas: admin_master gerencia tudo"
  on public.empresas for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "empresas: usuário vê empresas às quais tem acesso"
  on public.empresas for select
  using (id in (select public.empresas_acessiveis(auth.uid())));

-- ---------- grupos_empresas ----------
create policy "grupos_empresas: admin_master gerencia tudo"
  on public.grupos_empresas for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "grupos_empresas: usuário vê grupos aos quais pertence"
  on public.grupos_empresas for select
  using (id in (select grupo_id from public.usuario_grupos where user_id = auth.uid()));

-- ---------- grupo_empresas_membros ----------
create policy "grupo_empresas_membros: admin_master gerencia tudo"
  on public.grupo_empresas_membros for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "grupo_empresas_membros: usuário vê membros dos seus grupos"
  on public.grupo_empresas_membros for select
  using (grupo_id in (select grupo_id from public.usuario_grupos where user_id = auth.uid()));

-- ---------- usuario_empresas ----------
create policy "usuario_empresas: admin_master gerencia tudo"
  on public.usuario_empresas for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "usuario_empresas: usuário vê seus próprios acessos"
  on public.usuario_empresas for select
  using (user_id = auth.uid());

-- ---------- usuario_grupos ----------
create policy "usuario_grupos: admin_master gerencia tudo"
  on public.usuario_grupos for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "usuario_grupos: usuário vê seus próprios acessos"
  on public.usuario_grupos for select
  using (user_id = auth.uid());

-- =========================================================================
-- 6) RLS — REESCRITA DAS POLÍTICAS DAS TABELAS EXISTENTES (0001-0003)
--    para incorporar admin_master + escopo por empresa, preservando a
--    restrição de gestor (gestor_id = auth.uid()) como filtro ADICIONAL.
-- =========================================================================

-- ---------- profiles ----------
drop policy if exists "profiles: usuário vê o próprio perfil ou RH vê todos" on public.profiles;
create policy "profiles: usuário vê o próprio perfil ou RH/admin_master vê todos"
  on public.profiles for select
  using (id = auth.uid() or public.is_rh() or public.is_admin_master());

drop policy if exists "profiles: RH atualiza qualquer perfil (ex: promover a RH)" on public.profiles;
create policy "profiles: RH/admin_master atualiza qualquer perfil"
  on public.profiles for update
  using (public.is_rh() or public.is_admin_master());

-- ---------- cargos ----------
drop policy if exists "cargos: leitura para todos autenticados" on public.cargos;
create policy "cargos: leitura para quem pode ver a empresa (ou cargo legado)"
  on public.cargos for select
  to authenticated
  using (public.pode_ver_empresa(empresa_id));

drop policy if exists "cargos: só RH cria/edita/exclui" on public.cargos;
create policy "cargos: RH/admin_master da empresa cria"
  on public.cargos for insert
  with check (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "cargos: só RH atualiza" on public.cargos;
create policy "cargos: RH/admin_master da empresa atualiza"
  on public.cargos for update
  using (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "cargos: só RH exclui" on public.cargos;
create policy "cargos: RH/admin_master da empresa exclui"
  on public.cargos for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- faixas_salariais ----------
drop policy if exists "faixas: leitura para todos autenticados" on public.faixas_salariais;
create policy "faixas: leitura para quem pode ver a empresa (ou faixa legada)"
  on public.faixas_salariais for select
  to authenticated
  using (public.pode_ver_empresa(empresa_id));

drop policy if exists "faixas: só RH gerencia" on public.faixas_salariais;
create policy "faixas: RH/admin_master da empresa cria"
  on public.faixas_salariais for insert
  with check (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "faixas: só RH atualiza" on public.faixas_salariais;
create policy "faixas: RH/admin_master da empresa atualiza"
  on public.faixas_salariais for update
  using (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "faixas: só RH exclui" on public.faixas_salariais;
create policy "faixas: RH/admin_master da empresa exclui"
  on public.faixas_salariais for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- benchmarks_mercado ----------
drop policy if exists "benchmarks: leitura para todos autenticados" on public.benchmarks_mercado;
create policy "benchmarks: leitura para quem pode ver a empresa (ou legado)"
  on public.benchmarks_mercado for select
  to authenticated
  using (public.pode_ver_empresa(empresa_id));

drop policy if exists "benchmarks: só RH gerencia" on public.benchmarks_mercado;
create policy "benchmarks: RH/admin_master da empresa cria"
  on public.benchmarks_mercado for insert
  with check (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "benchmarks: só RH atualiza" on public.benchmarks_mercado;
create policy "benchmarks: RH/admin_master da empresa atualiza"
  on public.benchmarks_mercado for update
  using (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "benchmarks: só RH exclui" on public.benchmarks_mercado;
create policy "benchmarks: RH/admin_master da empresa exclui"
  on public.benchmarks_mercado for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- colaboradores ----------
drop policy if exists "colaboradores: RH vê todos, gestor vê só sua equipe" on public.colaboradores;
create policy "colaboradores: RH/admin_master da empresa vê todos, gestor vê sua equipe"
  on public.colaboradores for select
  using (public.pode_gerenciar_empresa(empresa_id) or gestor_id = auth.uid());

drop policy if exists "colaboradores: só RH cria" on public.colaboradores;
create policy "colaboradores: RH/admin_master da empresa cria"
  on public.colaboradores for insert
  with check (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "colaboradores: RH edita todos, gestor edita só sua equipe" on public.colaboradores;
create policy "colaboradores: RH/admin_master edita todos, gestor edita sua equipe"
  on public.colaboradores for update
  using (public.pode_gerenciar_empresa(empresa_id) or gestor_id = auth.uid());

drop policy if exists "colaboradores: só RH exclui" on public.colaboradores;
create policy "colaboradores: RH/admin_master da empresa exclui"
  on public.colaboradores for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- historico_salarial (escopo derivado de colaboradores) ----------
drop policy if exists "historico: RH vê tudo, gestor vê da sua equipe" on public.historico_salarial;
create policy "historico: RH/admin_master da empresa vê tudo, gestor vê da sua equipe"
  on public.historico_salarial for select
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = historico_salarial.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "historico: só RH insere manualmente" on public.historico_salarial;
create policy "historico: RH/admin_master da empresa insere manualmente"
  on public.historico_salarial for insert
  with check (
    exists (
      select 1 from public.colaboradores c
      where c.id = historico_salarial.colaborador_id and public.pode_gerenciar_empresa(c.empresa_id)
    )
  );

-- ---------- avaliacoes_disc (escopo derivado de colaboradores) ----------
drop policy if exists "disc: RH vê tudo, gestor vê da sua equipe" on public.avaliacoes_disc;
create policy "disc: RH/admin_master da empresa vê tudo, gestor vê da sua equipe"
  on public.avaliacoes_disc for select
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "disc: RH ou gestor da equipe pode aplicar avaliação" on public.avaliacoes_disc;
create policy "disc: RH/admin_master da empresa ou gestor da equipe pode aplicar avaliação"
  on public.avaliacoes_disc for insert
  with check (
    exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "disc: só RH edita/exclui avaliações" on public.avaliacoes_disc;
create policy "disc: RH/admin_master da empresa edita avaliações"
  on public.avaliacoes_disc for update
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id and public.pode_gerenciar_empresa(c.empresa_id)
    )
  );

drop policy if exists "disc: só RH exclui" on public.avaliacoes_disc;
create policy "disc: RH/admin_master da empresa exclui"
  on public.avaliacoes_disc for delete
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id and public.pode_gerenciar_empresa(c.empresa_id)
    )
  );

-- ---------- eventos_rh ----------
drop policy if exists "eventos_rh: RH vê tudo, gestor vê da sua equipe" on public.eventos_rh;
create policy "eventos_rh: RH/admin_master da empresa vê tudo, gestor vê da sua equipe"
  on public.eventos_rh for select
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "eventos_rh: RH ou gestor da equipe insere" on public.eventos_rh;
create policy "eventos_rh: RH/admin_master da empresa ou gestor da equipe insere"
  on public.eventos_rh for insert
  with check (
    exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "eventos_rh: RH ou gestor da equipe atualiza" on public.eventos_rh;
create policy "eventos_rh: RH/admin_master da empresa ou gestor da equipe atualiza"
  on public.eventos_rh for update
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id
        and (public.pode_gerenciar_empresa(c.empresa_id) or c.gestor_id = auth.uid())
    )
  );

drop policy if exists "eventos_rh: só RH exclui" on public.eventos_rh;
create policy "eventos_rh: RH/admin_master da empresa exclui"
  on public.eventos_rh for delete
  using (
    exists (
      select 1 from public.colaboradores c
      where c.id = eventos_rh.colaborador_id and public.pode_gerenciar_empresa(c.empresa_id)
    )
  );

-- ---------- treinamentos_rh ----------
drop policy if exists "treinamentos_rh: RH vê tudo, gestor vê da equipe, todos veem gerais" on public.treinamentos_rh;
create policy "treinamentos_rh: RH/admin_master vê tudo, gestor vê da equipe, gerais visíveis na empresa"
  on public.treinamentos_rh for select
  using (
    public.pode_gerenciar_empresa(empresa_id)
    or (colaborador_id is null and public.pode_ver_empresa(empresa_id))
    or exists (
      select 1 from public.colaboradores c
      where c.id = treinamentos_rh.colaborador_id and c.gestor_id = auth.uid()
    )
  );

drop policy if exists "treinamentos_rh: RH ou gestor da equipe insere" on public.treinamentos_rh;
create policy "treinamentos_rh: RH/admin_master da empresa ou gestor da equipe insere"
  on public.treinamentos_rh for insert
  with check (
    public.pode_gerenciar_empresa(empresa_id)
    or (
      colaborador_id is not null
      and exists (
        select 1 from public.colaboradores c
        where c.id = treinamentos_rh.colaborador_id and c.gestor_id = auth.uid()
      )
    )
  );

drop policy if exists "treinamentos_rh: só RH atualiza" on public.treinamentos_rh;
create policy "treinamentos_rh: RH/admin_master da empresa atualiza"
  on public.treinamentos_rh for update
  using (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "treinamentos_rh: só RH exclui" on public.treinamentos_rh;
create policy "treinamentos_rh: RH/admin_master da empresa exclui"
  on public.treinamentos_rh for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- pesquisa_rodadas ----------
drop policy if exists "pesquisa_rodadas: RH vê tudo" on public.pesquisa_rodadas;
create policy "pesquisa_rodadas: RH/admin_master da empresa vê tudo, ativas visíveis na empresa"
  on public.pesquisa_rodadas for select
  using (public.pode_gerenciar_empresa(empresa_id) or (ativo = true and public.pode_ver_empresa(empresa_id)));

drop policy if exists "pesquisa_rodadas: só RH cria" on public.pesquisa_rodadas;
create policy "pesquisa_rodadas: RH/admin_master da empresa cria"
  on public.pesquisa_rodadas for insert
  with check (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "pesquisa_rodadas: só RH atualiza" on public.pesquisa_rodadas;
create policy "pesquisa_rodadas: RH/admin_master da empresa atualiza"
  on public.pesquisa_rodadas for update
  using (public.pode_gerenciar_empresa(empresa_id));

drop policy if exists "pesquisa_rodadas: só RH exclui" on public.pesquisa_rodadas;
create policy "pesquisa_rodadas: RH/admin_master da empresa exclui"
  on public.pesquisa_rodadas for delete
  using (public.pode_gerenciar_empresa(empresa_id));

-- ---------- pesquisa_respostas (escopo derivado de pesquisa_rodadas) ----------
-- Continua sem qualquer política de insert/update/delete para
-- authenticated/anon — a única porta de entrada é submit_pesquisa_publica
-- (SECURITY DEFINER, inalterada por esta migration).
drop policy if exists "pesquisa_respostas: só RH lê (agregado, nunca por pessoa)" on public.pesquisa_respostas;
create policy "pesquisa_respostas: RH/admin_master da empresa lê (agregado, nunca por pessoa)"
  on public.pesquisa_respostas for select
  using (
    exists (
      select 1 from public.pesquisa_rodadas r
      where r.id = pesquisa_respostas.rodada_id and public.pode_gerenciar_empresa(r.empresa_id)
    )
  );

-- Observação: as funções SECURITY DEFINER públicas de 0002/0003
-- (get_colaborador_disc_publico, submit_avaliacao_disc_publica,
-- get_rodada_pesquisa_publica, submit_pesquisa_publica) rodam com os
-- privilégios do dono da função e IGNORAM row-level security — continuam
-- funcionando exatamente como antes, sem qualquer alteração aqui.
