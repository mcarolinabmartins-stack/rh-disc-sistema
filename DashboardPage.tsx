import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Card, StatCard } from "@/components/ui/primitives";
import { formatCurrency, monthsBetween } from "@/lib/utils";
import { compareToFaixaInterna, compareToMercado } from "@/lib/salaryCompare";
import { FACTOR_NAME, type DiscLetter } from "@/data/discWords";
import type { AvaliacaoDisc, BenchmarkMercado, Colaborador, EmpresaConfig, FaixaSalarial } from "@/types";

const DISC_COLORS: Record<DiscLetter, string> = { D: "#C1442A", I: "#C8901A", S: "#3E7D56", C: "#2E5F8A" };

export default function DashboardPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDisc[]>([]);
  const [faixas, setFaixas] = useState<FaixaSalarial[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkMercado[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: colabs }, { data: disc }, { data: f }, { data: b }, { data: e }] = await Promise.all([
        supabase.from("colaboradores").select("*, cargo:cargos(*)").eq("ativo", true),
        supabase.from("avaliacoes_disc").select("*").order("data_aplicacao", { ascending: false }),
        supabase.from("faixas_salariais").select("*"),
        supabase.from("benchmarks_mercado").select("*"),
        supabase.from("empresa_config").select("*").single(),
      ]);
      setColaboradores((colabs as Colaborador[]) ?? []);
      setAvaliacoes((disc as AvaliacaoDisc[]) ?? []);
      setFaixas((f as FaixaSalarial[]) ?? []);
      setBenchmarks((b as BenchmarkMercado[]) ?? []);
      setEmpresa((e as EmpresaConfig) ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const ultimaPorColaborador = useMemo(() => {
    const map = new Map<string, AvaliacaoDisc>();
    avaliacoes.forEach((a) => {
      if (!map.has(a.colaborador_id)) map.set(a.colaborador_id, a);
    });
    return map;
  }, [avaliacoes]);

  const discDistribution = useMemo(() => {
    const counts: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
    ultimaPorColaborador.forEach((a) => {
      counts[a.perfil_primario]++;
    });
    return (Object.keys(counts) as DiscLetter[])
      .map((f) => ({ name: `${f} · ${FACTOR_NAME[f]}`, letter: f, value: counts[f] }))
      .filter((d) => d.value > 0);
  }, [ultimaPorColaborador]);

  const pendentesReavaliacao = colaboradores.filter((c) => {
    const a = ultimaPorColaborador.get(c.id);
    if (!a) return true;
    return monthsBetween(a.data_aplicacao) >= 6;
  });

  const comparativos = colaboradores.map((c) => ({
    colaborador: c,
    faixa: compareToFaixaInterna(c, faixas),
    mercado: compareToMercado(c, benchmarks, empresa?.ramo_atuacao ?? ""),
  }));
  const abaixoMercado = comparativos.filter((c) => c.mercado.status === "abaixo").length;
  const acimaMercado = comparativos.filter((c) => c.mercado.status === "acima").length;
  const abaixoFaixaInterna = comparativos.filter((c) => c.faixa.status === "abaixo").length;

  const folhaTotal = colaboradores.reduce((sum, c) => sum + Number(c.salario_atual || 0), 0);

  const folhaPorSetor = useMemo(() => {
    const map = new Map<string, number>();
    colaboradores.forEach((c) => {
      const key = c.setor || "Sem setor";
      map.set(key, (map.get(key) ?? 0) + Number(c.salario_atual || 0));
    });
    return Array.from(map.entries())
      .map(([setor, total]) => ({ setor, total }))
      .sort((a, b) => b.total - a.total);
  }, [colaboradores]);

  if (loading) return <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>;

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--ink-muted)]">Visão executiva de perfis DISC, folha e posicionamento salarial.</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Colaboradores ativos" value={colaboradores.length} />
        <StatCard label="Folha mensal" value={formatCurrency(folhaTotal)} />
        <StatCard label="Abaixo do mercado" value={abaixoMercado} tone={abaixoMercado > 0 ? "bad" : "good"} sub={`${acimaMercado} acima do mercado`} />
        <StatCard label="Reavaliação DISC pendente" value={pendentesReavaliacao.length} tone={pendentesReavaliacao.length > 0 ? "warn" : "good"} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Distribuição de perfis DISC</h2>
          {discDistribution.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Nenhuma avaliação DISC registrada ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={discDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {discDistribution.map((d) => (
                    <Cell key={d.letter} fill={DISC_COLORS[d.letter]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _n, props) => [`${value} colaborador(es)`, props.payload.name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {discDistribution.map((d) => (
              <span key={d.letter} className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: DISC_COLORS[d.letter] }} /> {d.name} ({d.value})
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Folha por setor</h2>
          {folhaPorSetor.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Sem dados suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={folhaPorSetor} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="setor" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="#37324E" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Alertas de reavaliação DISC</h2>
          {pendentesReavaliacao.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Todo mundo em dia com o ciclo de 6 meses. 🎉</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pendentesReavaliacao.slice(0, 8).map((c) => {
                const a = ultimaPorColaborador.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <Link to={`/colaboradores/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.nome}
                    </Link>
                    <Badge tone="warn">{a ? `há ${monthsBetween(a.data_aplicacao)} meses` : "nunca avaliado"}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Posicionamento salarial</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Abaixo da faixa interna</span>
              <Badge tone={abaixoFaixaInterna > 0 ? "bad" : "good"}>{abaixoFaixaInterna}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Abaixo do mercado</span>
              <Badge tone={abaixoMercado > 0 ? "bad" : "good"}>{abaixoMercado}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Acima do mercado</span>
              <Badge tone="warn">{acimaMercado}</Badge>
            </div>
          </div>
          <Link to="/plano-cargos-salarios" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Ver plano de cargos e salários completo →
          </Link>
        </Card>
      </div>
    </div>
  );
}
