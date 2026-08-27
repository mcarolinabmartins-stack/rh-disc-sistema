# RH · DISC & Plano de Cargos e Salários

Sistema para cadastrar colaboradores e cargos, aplicar e acompanhar o DISC a cada 6 meses,
comparar salários com o mercado (por estado, ramo de atuação e regime CLT/PJ) e acompanhar
o plano de cargos e salários da empresa.

Stack: **React + TypeScript + Vite + Tailwind CSS + Supabase** (Postgres + Auth + RLS).

## O que o sistema tem

- **Colaboradores**: cadastro com cargo, setor, estado/cidade, regime de contratação (CLT/PJ), nível e salário.
- **Cargos**: descrição, perfil DISC ideal (D/I/S/C) e faixa salarial (plano de cargos e salários).
- **DISC**: questionário de 24 blocos aplicado a qualquer colaborador; salva histórico e calcula
  aderência ao perfil ideal do cargo atual. Dashboard alerta quem está a 6 meses ou mais sem reavaliação.
- **Plano de Cargos e Salários**: cada colaborador é comparado com a faixa interna do cargo e com o
  mercado (benchmarks por cargo + estado + ramo de atuação + regime CLT/PJ).
- **Dashboard executivo**: distribuição de perfis DISC, folha por setor, quem está abaixo/acima do
  mercado, alertas de reavaliação.
- **Login com dois papéis**: RH (acesso total) e Gestor (só vê e avalia sua própria equipe).

## Passo a passo para importar no Lovable

### 1. Suba este projeto para um repositório no GitHub

```bash
cd rh-disc-sistema
git init
git add .
git commit -m "Sistema RH DISC + Plano de Cargos e Salários"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

### 2. Crie o backend no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No painel do Supabase, abra **SQL Editor** → **New query**, cole todo o conteúdo de
   `supabase/migrations/0001_init.sql` e execute. Isso cria as tabelas, os triggers de histórico
   salarial e as políticas de segurança (RLS), além de 4 cargos de exemplo.
3. Em **Authentication → Providers**, deixe **Email** habilitado (login por e-mail/senha).
   Se quiser pular a confirmação por e-mail durante os testes, desative "Confirm email" em
   **Authentication → Settings**.

### 3. Importe no Lovable

1. No Lovable, escolha **Import from GitHub** e selecione o repositório que você acabou de criar.
   O app abre já com todas as telas funcionando (não é gerado por IA — é o código real).
2. Conecte o Supabase pela integração nativa do Lovable (**Supabase** no menu do projeto) e aponte
   para o mesmo projeto Supabase do passo 2 — isso preenche `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` automaticamente. Se preferir configurar manualmente, copie
   `.env.example` para `.env` e preencha com as chaves em **Project Settings → API** no Supabase.

### 4. Crie o primeiro usuário RH

1. Abra o app publicado, clique em "Não tem conta? Criar acesso" e crie sua conta — por padrão
   toda conta nova entra como **Gestor(a)**.
2. Volte ao **SQL Editor** do Supabase e rode, trocando pelo seu e-mail:

```sql
update public.profiles set role = 'rh' where email = 'voce@suaempresa.com';
```

3. Faça login novamente — agora você tem acesso de RH e vê o menu **Configurações**.

### 5. Configure a empresa e comece a usar

1. Em **Configurações**, preencha o **ramo de atuação** da empresa (usado para casar com os
   benchmarks de mercado) e cadastre alguns **benchmarks de mercado** (cargo + estado + ramo +
   regime CLT/PJ + faixa salarial).
2. Em **Cargos**, ajuste os cargos de exemplo ou crie os seus, definindo o perfil DISC ideal e a
   faixa salarial interna.
3. Em **Colaboradores**, cadastre sua equipe. Cada colaborador criado já gera automaticamente a
   primeira linha do histórico salarial (motivo "admissão").
4. Abra o perfil de um colaborador e clique em **Aplicar DISC** para rodar a avaliação — o sistema
   grava o histórico e calcula a aderência ao cargo atual.

## Rodando localmente (opcional, fora do Lovable)

```bash
npm install
cp .env.example .env   # preencha com as chaves do seu projeto Supabase
npm run dev
```

## Como funciona a comparação salarial com o mercado

Para cada colaborador, o sistema procura o benchmark mais específico disponível, nesta ordem:

1. Cargo + estado + ramo de atuação da empresa + regime de contratação (match exato)
2. Cargo + estado + regime de contratação (média entre os ramos cadastrados nesse estado)
3. Cargo + regime de contratação (média geral)
4. Cargo (média entre tudo que houver cadastrado)

O regime de contratação (CLT/PJ) é sempre priorizado porque as faixas costumam não ser
comparáveis diretamente entre os dois regimes. O status exibido (abaixo / dentro / acima) compara
o salário atual com o mínimo e o máximo do benchmark encontrado.

## Estrutura do banco (Supabase)

- `profiles` — usuários do sistema e papel (`rh` ou `gestor`).
- `empresa_config` — nome e ramo de atuação da empresa (linha única).
- `cargos` — título, área, nível, descrição e perfil DISC ideal (0–100 em cada eixo).
- `faixas_salariais` — faixas do plano de cargos e salários por cargo, com vigência.
- `benchmarks_mercado` — faixas de mercado por cargo, estado, ramo de atuação e regime CLT/PJ.
- `colaboradores` — dados cadastrais, cargo, setor, gestor responsável, salário e regime.
- `historico_salarial` — linha do tempo de salário/cargo/nível, gerada automaticamente por
  triggers sempre que um colaborador é admitido ou tem esses dados alterados.
- `avaliacoes_disc` — cada aplicação do DISC, com os scores normalizados (0–100) e a aderência
  calculada ao cargo do colaborador na época da avaliação.

Todas as tabelas têm Row Level Security: RH enxerga e edita tudo; gestores só veem e avaliam os
colaboradores vinculados a eles pelo campo "gestor" no cadastro.
