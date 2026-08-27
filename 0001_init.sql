-- =========================================================================
-- Sistema RH · DISC + Plano de Cargos e Salários
-- Migration inicial: tabelas, relacionamentos, triggers, RLS
-- =========================================================================

-- ---------- Extensões ----------
create extension if not exists "pgcrypto";

-- =========================================================================
-- 1) PERFIS DE USUÁRIO (RH x Gestor)
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'gestor' check (role in ('rh', 'gestor')),
  created_at timestamptz not null default now()
);

-- cria automaticamente um profile (papel padrão: gestor) quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- função auxiliar para políticas: usuário logado é RH?
create or replace function public.is_rh()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'rh'
  );
$$;

-- =========================================================================
-- 2) CONFIGURAÇÃO DA EMPRESA (ramo de atuação usado no benchmark salarial)
-- =========================================================================
create table if not exists public.empresa_config (
  id int primary key default 1 check (id = 1), -- linha única
  nome_empresa text not null default 'Minha Empresa',
  ramo_atuacao text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.empresa_config (id) values (1) on conflict (id) do nothing;

-- =========================================================================
-- 3) CARGOS (com descrição e perfil DISC ideal do cargo)
-- =========================================================================
create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  area text not null default '',
  nivel text not null default 'pleno' check (nivel in ('junior', 'pleno', 'senior', 'especialista', 'lideranca')),
  descricao text not null default '',
  disc_ideal_d smallint not null default 50 check (disc_ideal_d between 0 and 100),
  disc_ideal_i smallint not null default 50 check (disc_ideal_i between 0 and 100),
  disc_ideal_s smallint not null default 50 check (disc_ideal_s between 0 and 100),
  disc_ideal_c smallint not null default 50 check (disc_ideal_c between 0 and 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- 4) FAIXAS SALARIAIS (Plano de Cargos e Salários interno)
-- =========================================================================
create table if not exists public.faixas_salariais (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references public.cargos (id) on delete cascade,
  salario_min numeric(12, 2) not null,
  salario_medio numeric(12, 2) not null,
  salario_max numeric(12, 2) not null,
  vigencia_inicio date not null default current_date,
  vigencia_fim date,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  constraint faixa_valida check (salario_min <= salario_medio and salario_medio <= salario_max)
);

create index if not exists idx_faixas_cargo on public.faixas_salariais (cargo_id, vigencia_inicio desc);

-- =========================================================================
-- 5) BENCHMARK DE MERCADO (por cargo + estado + ramo de atuação)
-- =========================================================================
create table if not exists public.benchmarks_mercado (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references public.cargos (id) on delete cascade,
  estado char(2) not null, -- UF, ex: 'SP'
  ramo_atuacao text not null default '',
  regime_contratacao text not null default 'CLT' check (regime_contratacao in ('CLT', 'PJ')),
  salario_min numeric(12, 2) not null,
  salario_medio numeric(12, 2) not null,
  salario_max numeric(12, 2) not null,
  fonte text not null default '',
  data_referencia date not null default current_date,
  created_at timestamptz not null default now(),
  constraint benchmark_valido check (salario_min <= salario_medio and salario_medio <= salario_max)
);

create index if not exists idx_benchmark_lookup on public.benchmarks_mercado (cargo_id, estado, ramo_atuacao);

-- =========================================================================
-- 6) COLABORADORES
-- =========================================================================
create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  cargo_id uuid references public.cargos (id) on delete set null,
  gestor_id uuid references public.profiles (id) on delete set null,
  setor text not null default '',
  estado char(2) not null,
  cidade text not null default '',
  data_admissao date not null default current_date,
  salario_atual numeric(12, 2) not null default 0,
  regime_contratacao text not null default 'CLT' check (regime_contratacao in ('CLT', 'PJ')),
  nivel text not null default 'pleno' check (nivel in ('junior', 'pleno', 'senior', 'especialista', 'lideranca')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_colaboradores_gestor on public.colaboradores (gestor_id);
create index if not exists idx_colaboradores_cargo on public.colaboradores (cargo_id);
create index if not exists idx_colaboradores_setor on public.colaboradores (setor);

-- =========================================================================
-- 7) HISTÓRICO SALARIAL (linha do tempo do plano de cargos e salários)
-- =========================================================================
create table if not exists public.historico_salarial (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id) on delete cascade,
  cargo_id uuid references public.cargos (id) on delete set null,
  nivel text not null default 'pleno',
  salario numeric(12, 2) not null,
  regime_contratacao text not null default 'CLT' check (regime_contratacao in ('CLT', 'PJ')),
  motivo text not null default 'ajuste' check (motivo in ('admissao', 'reajuste', 'promocao', 'equiparacao', 'ajuste')),
  data_alteracao date not null default current_date,
  registrado_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_colaborador on public.historico_salarial (colaborador_id, data_alteracao desc);

-- grava automaticamente o primeiro registro do histórico ao admitir um colaborador
create or replace function public.log_admissao_salarial()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.historico_salarial (colaborador_id, cargo_id, nivel, salario, regime_contratacao, motivo, data_alteracao, registrado_por)
  values (new.id, new.cargo_id, new.nivel, new.salario_atual, new.regime_contratacao, 'admissao', new.data_admissao, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_log_admissao on public.colaboradores;
create trigger trg_log_admissao
  after insert on public.colaboradores
  for each row execute procedure public.log_admissao_salarial();

-- grava automaticamente uma linha do histórico sempre que salário, cargo ou nível mudam
create or replace function public.log_alteracao_salarial()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.salario_atual is distinct from old.salario_atual)
     or (new.cargo_id is distinct from old.cargo_id)
     or (new.nivel is distinct from old.nivel)
     or (new.regime_contratacao is distinct from old.regime_contratacao) then
    insert into public.historico_salarial (colaborador_id, cargo_id, nivel, salario, regime_contratacao, motivo, data_alteracao, registrado_por)
    values (
      new.id,
      new.cargo_id,
      new.nivel,
      new.salario_atual,
      new.regime_contratacao,
      case when new.cargo_id is distinct from old.cargo_id then 'promocao' else 'reajuste' end,
      current_date,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_alteracao on public.colaboradores;
create trigger trg_log_alteracao
  after update on public.colaboradores
  for each row execute procedure public.log_alteracao_salarial();

-- =========================================================================
-- 8) AVALIAÇÕES DISC (aplicadas a cada 6 meses)
-- =========================================================================
create table if not exists public.avaliacoes_disc (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id) on delete cascade,
  data_aplicacao date not null default current_date,
  score_d smallint not null check (score_d between 0 and 100),
  score_i smallint not null check (score_i between 0 and 100),
  score_s smallint not null check (score_s between 0 and 100),
  score_c smallint not null check (score_c between 0 and 100),
  perfil_primario char(1) not null check (perfil_primario in ('D', 'I', 'S', 'C')),
  perfil_secundario char(1) not null check (perfil_secundario in ('D', 'I', 'S', 'C')),
  compatibilidade_cargo smallint, -- % de aderência ao disc_ideal do cargo atual no momento da avaliação
  respostas jsonb not null default '[]',
  aplicado_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_disc_colaborador on public.avaliacoes_disc (colaborador_id, data_aplicacao desc);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.empresa_config enable row level security;
alter table public.cargos enable row level security;
alter table public.faixas_salariais enable row level security;
alter table public.benchmarks_mercado enable row level security;
alter table public.colaboradores enable row level security;
alter table public.historico_salarial enable row level security;
alter table public.avaliacoes_disc enable row level security;

-- ---------- profiles ----------
create policy "profiles: usuário vê o próprio perfil ou RH vê todos"
  on public.profiles for select
  using (id = auth.uid() or public.is_rh());

create policy "profiles: usuário atualiza o próprio perfil"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: RH atualiza qualquer perfil (ex: promover a RH)"
  on public.profiles for update
  using (public.is_rh());

-- ---------- empresa_config ----------
create policy "empresa_config: leitura para todos autenticados"
  on public.empresa_config for select
  to authenticated
  using (true);

create policy "empresa_config: só RH edita"
  on public.empresa_config for update
  using (public.is_rh());

-- ---------- cargos ----------
create policy "cargos: leitura para todos autenticados"
  on public.cargos for select
  to authenticated
  using (true);

create policy "cargos: só RH cria/edita/exclui"
  on public.cargos for insert
  with check (public.is_rh());
create policy "cargos: só RH atualiza"
  on public.cargos for update
  using (public.is_rh());
create policy "cargos: só RH exclui"
  on public.cargos for delete
  using (public.is_rh());

-- ---------- faixas_salariais ----------
create policy "faixas: leitura para todos autenticados"
  on public.faixas_salariais for select
  to authenticated
  using (true);

create policy "faixas: só RH gerencia"
  on public.faixas_salariais for insert
  with check (public.is_rh());
create policy "faixas: só RH atualiza"
  on public.faixas_salariais for update
  using (public.is_rh());
create policy "faixas: só RH exclui"
  on public.faixas_salariais for delete
  using (public.is_rh());

-- ---------- benchmarks_mercado ----------
create policy "benchmarks: leitura para todos autenticados"
  on public.benchmarks_mercado for select
  to authenticated
  using (true);

create policy "benchmarks: só RH gerencia"
  on public.benchmarks_mercado for insert
  with check (public.is_rh());
create policy "benchmarks: só RH atualiza"
  on public.benchmarks_mercado for update
  using (public.is_rh());
create policy "benchmarks: só RH exclui"
  on public.benchmarks_mercado for delete
  using (public.is_rh());

-- ---------- colaboradores ----------
create policy "colaboradores: RH vê todos, gestor vê só sua equipe"
  on public.colaboradores for select
  using (public.is_rh() or gestor_id = auth.uid());

create policy "colaboradores: só RH cria"
  on public.colaboradores for insert
  with check (public.is_rh());

create policy "colaboradores: RH edita todos, gestor edita só sua equipe"
  on public.colaboradores for update
  using (public.is_rh() or gestor_id = auth.uid());

create policy "colaboradores: só RH exclui"
  on public.colaboradores for delete
  using (public.is_rh());

-- ---------- historico_salarial ----------
create policy "historico: RH vê tudo, gestor vê da sua equipe"
  on public.historico_salarial for select
  using (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = historico_salarial.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "historico: só RH insere manualmente"
  on public.historico_salarial for insert
  with check (public.is_rh());

-- ---------- avaliacoes_disc ----------
create policy "disc: RH vê tudo, gestor vê da sua equipe"
  on public.avaliacoes_disc for select
  using (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "disc: RH ou gestor da equipe pode aplicar avaliação"
  on public.avaliacoes_disc for insert
  with check (
    public.is_rh()
    or exists (
      select 1 from public.colaboradores c
      where c.id = avaliacoes_disc.colaborador_id and c.gestor_id = auth.uid()
    )
  );

create policy "disc: só RH edita/exclui avaliações"
  on public.avaliacoes_disc for update
  using (public.is_rh());
create policy "disc: só RH exclui"
  on public.avaliacoes_disc for delete
  using (public.is_rh());

-- =========================================================================
-- 9) SEED — dados de exemplo (opcional, remova se preferir começar vazio)
-- =========================================================================
insert into public.cargos (titulo, area, nivel, descricao, disc_ideal_d, disc_ideal_i, disc_ideal_s, disc_ideal_c)
values
  ('Analista Financeiro', 'Financeiro', 'pleno', 'Responsável por análises orçamentárias, fluxo de caixa e relatórios financeiros.', 30, 20, 45, 90),
  ('Executivo(a) de Vendas', 'Comercial', 'pleno', 'Prospecção e fechamento de novos clientes, gestão de carteira e metas comerciais.', 80, 75, 30, 25),
  ('Analista de RH', 'Recursos Humanos', 'pleno', 'Recrutamento, seleção, cultura organizacional e apoio a processos de gente e gestão.', 35, 70, 65, 45),
  ('Desenvolvedor(a) de Software', 'Tecnologia', 'senior', 'Desenvolvimento e manutenção de sistemas, boas práticas de engenharia e code review.', 35, 25, 45, 85)
on conflict do nothing;
