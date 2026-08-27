import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Card, EmptyState, Select } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/utils";
import { compareToFaixaInterna, compareToMercado, STATUS_LABEL, STATUS_TONE } from "@/lib/salaryCompare";
import type { BenchmarkMercado, Colaborador, EmpresaConfig, FaixaSalarial } from "@/types";

export default function PlanoCargosSalariosPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [faixas, setFaixas] = useState<FaixaSalarial[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkMercado[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  useEffect(() => {
    async function load() {
      const [{ data: colabs }, { data: f }, { data: b }, { data: e }] = await Promise.all([
        supabase.from("colaboradores").select("*, cargo:cargos(*)").eq("ativo", true).order("nome"),
        supabase.from("faixas_salariais").select("*"),
        supabase.from("benchmarks_mercado").select("*"),
        supabase.from("empresa_config").select("*").single(),
      ]);
      setColaboradores((colabs as Colaborador[]) ?? []);
      setFaixas((f as FaixaSalarial[]) ?? []);
      setBenchmarks((b as BenchmarkMercado[]) ?? []);
      setEmpresa((e as EmpresaConfig) ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const rows = colaboradores.map((c) => ({
    colaborador: c,
    faixa: compareToFaixaInterna(c, faixas),
    mercado: compareToMercado(c, benchmarks, empresa?.ramo_atuacao ?? ""),
  }));

  const filtered = filtroStatus === "todos" ? rows : rows.filter((r) => r.faixa.status === filtroStatus || r.mercado.status === filtroStatus);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Plano de Cargos e Salários</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            Posição de cada colaborador ativo frente à faixa interna e ao mercado ({empresa?.ramo_atuacao || "ramo não definido"}).
          </p>
        </div>
        <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-56">
          <option value="todos">Todos os status</option>
          <option value="abaixo">Abaixo</option>
          <option value="dentro">Dentro da faixa</option>
          <option value="acima">Acima</option>
          <option value="sem_dado">Sem dado</option>
        </Select>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState title="Nenhum colaborador nesse filtro" />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                    <th className="px-5 py-3 font-semibold">Colaborador</th>
                    <th className="px-5 py-3 font-semibold">Cargo</th>
                    <th className="px-5 py-3 text-right font-semibold">Salário</th>
                    <th className="px-5 py-3 font-semibold">Faixa interna</th>
                    <th className="px-5 py-3 font-semibold">Mercado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ colaborador, faixa, mercado }) => (
                    <tr key={colaborador.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-sunken)]">
                      <td className="px-5 py-3">
                        <Link to={`/colaboradores/${colaborador.id}`} className="font-semibold text-brand-700 hover:underline">
                          {colaborador.nome}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[var(--ink-muted)]">{colaborador.cargo?.titulo ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">{formatCurrency(colaborador.salario_atual)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[faixa.status]}>{STATUS_LABEL[faixa.status]}</Badge>
                        {faixa.diffPct != null && <span className="ml-2 font-mono text-xs tabular-nums text-[var(--ink-muted)]">{faixa.diffPct > 0 ? "+" : ""}{faixa.diffPct}%</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[mercado.status]}>{STATUS_LABEL[mercado.status]}</Badge>
                        {mercado.diffPct != null && <span className="ml-2 font-mono text-xs tabular-nums text-[var(--ink-muted)]">{mercado.diffPct > 0 ? "+" : ""}{mercado.diffPct}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
