# Como aplicar esta atualização no PeopleHub

Este pacote traz **só o que é novo ou mudou** desde o relatório antigo — nada de arquivos que já estavam lá sem alteração. Está dividido em duas pastas, porque cada uma vai para um lugar diferente:

## 📁 Pasta `github/` → vai para o seu repositório no GitHub

Copie o conteúdo desta pasta para dentro da pasta do seu projeto (mesclando/sobrescrevendo — a estrutura de subpastas já vem pronta: `src/lib/...`, `src/pages/...` etc., exatamente como precisa ficar no repositório).

**Arquivos novos** (não existiam antes):
- `src/lib/rhIndicadores.ts`
- `src/lib/vagaDiscSugestao.ts`
- `src/pages/IndicadoresRHPage.tsx`
- `src/pages/PesquisaClimaAdminPage.tsx`
- `src/pages/PesquisaPublicaPage.tsx`
- `src/pages/VagasPage.tsx`
- `src/pages/VagaCandidaturaPublicaPage.tsx`
- `src/pages/VagaPreenchimentoPublicaPage.tsx`
- `src/pages/admin/EmpresasPage.tsx`
- `src/pages/admin/GruposEmpresasPage.tsx`
- `src/pages/admin/UsuariosAcessoPage.tsx`

**Arquivos que já existiam e devem ser substituídos** (sobrescreva pelo conteúdo daqui):
- `src/types/index.ts`
- `src/lib/utils.ts`
- `src/lib/discReportContent.ts`
- `src/lib/discReportEngine.ts`
- `src/components/disc/DiscReport.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/context/AuthContext.tsx`
- `src/pages/ColaboradorDetailPage.tsx`
- `src/pages/ColaboradoresListPage.tsx`
- `src/pages/CargosListPage.tsx`
- `src/App.tsx`

Depois de copiar, dentro da pasta do projeto no seu computador:

```bash
git add .
git commit -m "Atualiza area de RH, multiempresa, vagas e analise comportamental"
git push
```

## 📁 Pasta `supabase-migrations/` → vai para o SQL Editor do Supabase

Estes são scripts de banco de dados, **não fazem parte do código do GitHub** (embora seja comum guardar uma cópia deles no repositório, dentro de `supabase/migrations/`, para ter esse histórico versionado — se seu projeto já segue essa prática, copie-os também para lá).

No painel do Supabase → **SQL Editor**, abra e rode cada arquivo **nesta ordem exata**, um de cada vez, conferindo que não deu erro antes de passar para o próximo:

1. `0003_rh_operacional.sql` — cria as tabelas de férias, faltas, atestados, banco de horas, treinamentos e pesquisa de clima/eNPS.
2. `0004_multiempresa.sql` — cria empresas, grupos de empresas, o papel de admin master e as regras de acesso por empresa.
3. `0005_vagas.sql` — cria vagas, candidatos e os links públicos de candidatura/preenchimento.

⚠️ Se algum desses três já foi rodado anteriormente (por exemplo, se você já tinha aplicado uma versão passada), o Supabase vai avisar com erro de "já existe" — nesse caso, pule esse arquivo específico e siga para o próximo.

Depois de rodar os três, confira em **Storage** se o bucket `curriculos` foi criado (usado para os currículos anexados nas candidaturas de vaga). Se não aparecer, crie manualmente: Storage → New bucket → nome `curriculos` → privado.

## O que NÃO precisa mexer

A parte de hoje (Análise Comportamental Detalhada, dentro do relatório DISC) é só código — não tem nenhum SQL novo associado a ela.

## Depois de aplicar tudo

No Lovable, force um novo build/deploy a partir do GitHub atualizado (ou aguarde a sincronização automática, se estiver configurada). As variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) continuam as mesmas — nenhuma nova variável foi criada.
