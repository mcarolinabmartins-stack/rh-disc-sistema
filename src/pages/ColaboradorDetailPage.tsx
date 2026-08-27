import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { DiscBarChart } from "@/components/disc/DiscBarChart";
import { DiscQuizModal } from "@/components/disc/DiscQuizModal";
import { ESTADOS_BR, NIVEIS, REGIMES, formatCurrency, formatDate, monthsBetween } from "@/lib/utils";
import { compareToFaixaInterna, compareToMercado, STATUS_LABEL, STATUS_TONE, MATCH_LEVEL_LABEL } from "@/lib/salaryCompare";
import type { AvaliacaoDisc, BenchmarkMercado, Cargo, Colaborador, EmpresaConfig, FaixaSalarial, HistoricoSalarial } from "@/types";
import type { DiscLetter } from "@/data/discWords";

export default function ColaboradorDetailPage() {
  const { id } = useParams();
  const { isRh } = useAuth();

  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [faixas, setFaixas] = useState<FaixaSalarial[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkMercado[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [historico, setHistorico] = useState<HistoricoSalarial[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDisc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [editing, setEditing] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [
      { data: colab },
      { data: cargosData },
      { data: faixasData },
      { data: benchmarksData },
      { data: empresaData },
      { data: historicoData },
      { data: discData },
    ] = await Promise.all([
      supabase.from("colaboradores").select("*, cargo:cargos(*)").eq("id", id).single(),
      supabase.from("cargos").select("*").order("titulo"),
      supabase.from("faixas_salariais").select("*"),
      supabase.from("benchmarks_mercado").select("*"),
      supabase.from("empresa_config").select("*").single(),
      supabase.from("historico_salarial").select("*").eq("colaborador_id", id).order("data_alteracao", { ascending: false }),
      supabase.from("avaliacoes_disc").select("*").eq("colaborador_id", id).order("data_aplicacao", { ascending: false }),
    ]);
    setColaborador((colab as Colaborador) ?? null);
    setCargos((cargosData as Cargo[]) ?? []);
    setFaixas((faixasData as FaixaSalarial[]) ?? []);
    setBenchmarks((benchmarksData as BenchmarkMercado[]) ?? []);
    setEmpresa((empresaData as EmpresaConfig) ?? null);
    setHistorico((historicoData as HistoricoSalarial[]) ?? []);
    setAvaliacoes((discData as AvaliacaoDisc[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>;
  if (!colaborador) return <p className="text-sm text-[var(--ink-muted)]">Colaborador não encontrado.</p>;

  const faixaCmp = compareToFaixaInterna(colaborador, faixas);
  const mercadoCmp = compareToMercado(colaborador, benchmarks, empresa?.ramo_atuacao ?? "");
  const ultimaAvaliacao = avaliacoes[0];
  const mesesDesdeUltima = ultimaAvaliacao ? monthsBetween(ultimaAvaliacao.data_aplicacao) : null;
  const precisaReavaliar = mesesDesdeUltima == null || mesesDesdeUltima >= 6;

  async function handleSaveDisc(result: {
    norm: Record<DiscLetter, number>;
    primary: DiscLetter;
    secondary: DiscLetter;
    compatibilidade: number | null;
    respostas: { block: number; most: DiscLetter; least: DiscLetter }[];
  }) {
    if (!colaborador) return;
    await supabase.from("avaliacoes_disc").insert({
      colaborador_id: colaborador.id,
      score_d: result.norm.D,
      score_i: result.norm.I,
      score_s: result.norm.S,
      score_c: result.norm.C,
      perfil_primario: result.primary,
      perfil_secundario: result.secondary,
      compatibilidade_cargo: result.compatibilidade,
      respostas: result.respostas,
    });
    load();
  }

  return (
    <div>
      <Link to="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft size={15} /> Colaboradores
      </Link>

      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{colaborador.nome}</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {colaborador.cargo?.titulo ?? "Sem cargo"} · {colaborador.setor || "Sem setor"} · {colaborador.cidade ? `${colaborador.cidade}/` : ""}
            {colaborador.estado} · {colaborador.regime_contratacao}
          </p>
        </div>
        <div className="flex gap-2">
          {isRh && (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Editar cadastro
            </Button>
          )}
          <Button onClick={() => setShowQuiz(true)}>
            <ClipboardCheck size={16} /> Aplicar DISC
          </Button>
        </div>
      </div>

      {precisaReavaliar && (
        <Card className="mb-6 border-disc-i/40 bg-disc-iSoft p-4">
          <p className="text-sm font-semibold text-disc-i">
            {ultimaAvaliacao ? `Reavaliação DISC pendente — última aplicação há ${mesesDesdeUltima} meses.` : "Nenhuma avaliação DISC aplicada ainda."}
          </p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Salário atual</p>
          <p className="mt-2 font-display text-2xl font-semibold">{formatCurrency(colaborador.salario_atual)}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{colaborador.regime_contratacao} · Admitido em {formatDate(colaborador.data_admissao)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Faixa interna (plano de cargos)</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={STATUS_TONE[faixaCmp.status]}>{STATUS_LABEL[faixaCmp.status]}</Badge>
            {faixaCmp.diffPct != null && <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">{faixaCmp.diffPct > 0 ? "+" : ""}{faixaCmp.diffPct}% vs. médio</span>}
          </div>
          {faixaCmp.faixa && (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {formatCurrency(faixaCmp.faixa.salario_min)} – {formatCurrency(faixaCmp.faixa.salario_max)}
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Mercado ({colaborador.estado})</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={STATUS_TONE[mercadoCmp.status]}>{STATUS_LABEL[mercadoCmp.status]}</Badge>
            {mercadoCmp.diffPct != null && <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">{mercadoCmp.diffPct > 0 ? "+" : ""}{mercadoCmp.diffPct}% vs. médio</span>}
          </div>
          {mercadoCmp.benchmark && (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {formatCurrency(mercadoCmp.benchmark.salario_min)} – {formatCurrency(mercadoCmp.benchmark.salario_max)}
            </p>
          )}
          {mercadoCmp.matchLevel !== "nenhum" && <p className="mt-1 text-[11px] text-[var(--ink-faint,var(--ink-muted))]">{MATCH_LEVEL_LABEL[mercadoCmp.matchLevel]}</p>}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Histórico de avaliações DISC</h2>
          {avaliacoes.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Nenhuma avaliação registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {avaliacoes.map((a, idx) => (
                <div key={a.id} className={idx > 0 ? "border-t border-[var(--border)] pt-5" : ""}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {a.perfil_primario}
                      {a.perfil_secundario} · {formatDate(a.data_aplicacao)}
                    </p>
                    {a.compatibilidade_cargo != null && (
                      <Badge tone={a.compatibilidade_cargo >= 70 ? "good" : a.compatibilidade_cargo >= 45 ? "warn" : "bad"}>
                        {a.compatibilidade_cargo}% aderência ao cargo
                      </Badge>
                    )}
                  </div>
                  <DiscBarChart scores={{ D: a.score_d, I: a.score_i, S: a.score_s, C: a.score_c }} compact />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Histórico salarial</h2>
          {historico.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Sem histórico registrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Motivo</th>
                  <th className="pb-2 text-right font-semibold">Salário</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-t border-[var(--border)]">
                    <td className="py-2">{formatDate(h.data_alteracao)}</td>
                    <td className="py-2 capitalize text-[var(--ink-muted)]">{h.motivo} · {h.regime_contratacao}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatCurrency(h.salario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <DiscQuizModal
        open={showQuiz}
        onClose={() => setShowQuiz(false)}
        colaboradorNome={colaborador.nome}
        cargo={colaborador.cargo ?? null}
        onSave={handleSaveDisc}
      />

      {editing && (
        <EditColaboradorModal
          colaborador={colaborador}
          cargos={cargos}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditColaboradorModal({
  colaborador,
  cargos,
  onClose,
  onSaved,
}: {
  colaborador: Colaborador;
  cargos: Cargo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: colaborador.nome,
    email: colaborador.email,
    cargo_id: colaborador.cargo_id ?? "",
    setor: colaborador.setor,
    estado: colaborador.estado,
    cidade: colaborador.cidade,
    salario_atual: String(colaborador.salario_atual),
    regime_contratacao: colaborador.regime_contratacao,
    nivel: colaborador.nivel,
    ativo: colaborador.ativo,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("colaboradores")
      .update({
        nome: form.nome,
        email: form.email,
        cargo_id: form.cargo_id || null,
        setor: form.setor,
        estado: form.estado,
        cidade: form.cidade,
        salario_atual: Number(form.salario_atual) || 0,
        regime_contratacao: form.regime_contratacao,
        nivel: form.nivel,
        ativo: form.ativo,
      })
      .eq("id", colaborador.id);
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm">
      <Card className="w-full max-w-2xl p-6">
        <h2 className="mb-5 font-display text-xl font-semibold">Editar colaborador</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <Field label="Nome completo">
            <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Cargo">
            <Select value={form.cargo_id} onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}>
              <option value="">Selecione…</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Setor">
            <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
          </Field>
          <Field label="Nível">
            <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value as Colaborador["nivel"] })}>
              {NIVEIS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Regime de contratação">
            <Select
              value={form.regime_contratacao}
              onChange={(e) => setForm({ ...form, regime_contratacao: e.target.value as Colaborador["regime_contratacao"] })}
            >
              {REGIMES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado (UF)">
            <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_BR.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cidade">
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </Field>
          <Field label="Salário atual (R$)">
            <Input type="number" min="0" step="0.01" required value={form.salario_atual} onChange={(e) => setForm({ ...form, salario_atual: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.ativo ? "1" : "0"} onChange={(e) => setForm({ ...form, ativo: e.target.value === "1" })}>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </Select>
          </Field>

          {error && <p className="col-span-2 text-sm text-disc-d">{error}</p>}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
