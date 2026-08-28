import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, ClipboardCheck, FileText, MessageCircle, Plus, UserX } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { DiscBarChart } from "@/components/disc/DiscBarChart";
import { DiscQuizModal } from "@/components/disc/DiscQuizModal";
import { ESTADOS_BR, NIVEIS, REGIMES, buildDiscWhatsAppLink, formatCurrency, formatDate, monthsBetween } from "@/lib/utils";
import { compareToFaixaInterna, compareToMercado, STATUS_LABEL, STATUS_TONE, MATCH_LEVEL_LABEL } from "@/lib/salaryCompare";
import type { AvaliacaoDisc, BenchmarkMercado, Cargo, Colaborador, EmpresaConfig, EventoRH, FaixaSalarial, HistoricoSalarial, TipoEventoRH } from "@/types";
import type { DiscLetter } from "@/data/discWords";

const TIPO_EVENTO_LABEL: Record<TipoEventoRH, string> = {
  ferias: "Férias",
  falta: "Falta",
  atestado: "Atestado",
  atraso: "Atraso",
  banco_horas: "Banco de horas",
  ida_medico: "Ida ao médico",
};

const TIPO_EVENTO_TONE: Record<TipoEventoRH, "neutral" | "good" | "warn" | "bad" | "brand"> = {
  ferias: "good",
  falta: "bad",
  atestado: "warn",
  atraso: "warn",
  banco_horas: "brand",
  ida_medico: "neutral",
};

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
  const [eventos, setEventos] = useState<EventoRH[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showEvento, setShowEvento] = useState(false);
  const [showDesligamento, setShowDesligamento] = useState(false);

  async function load() {
    if (!id) return;
    // TODO: filtrar "cargos" por empresa_id (empresaAtiva do AuthContext) —
    // o dropdown de troca de cargo abaixo hoje lista cargos de todas as
    // empresas às quais o usuário tem acesso via RLS, não só a empresa do
    // colaborador em questão.
    setLoading(true);
    const [
      { data: colab },
      { data: cargosData },
      { data: faixasData },
      { data: benchmarksData },
      { data: empresaData },
      { data: historicoData },
      { data: discData },
      { data: eventosData },
    ] = await Promise.all([
      supabase.from("colaboradores").select("*, cargo:cargos(*)").eq("id", id).single(),
      supabase.from("cargos").select("*").order("titulo"),
      supabase.from("faixas_salariais").select("*"),
      supabase.from("benchmarks_mercado").select("*"),
      supabase.from("empresa_config").select("*").single(),
      supabase.from("historico_salarial").select("*").eq("colaborador_id", id).order("data_alteracao", { ascending: false }),
      supabase.from("avaliacoes_disc").select("*").eq("colaborador_id", id).order("data_aplicacao", { ascending: false }),
      supabase.from("eventos_rh").select("*").eq("colaborador_id", id).order("data_inicio", { ascending: false }),
    ]);
    setColaborador((colab as Colaborador) ?? null);
    setCargos((cargosData as Cargo[]) ?? []);
    setFaixas((faixasData as FaixaSalarial[]) ?? []);
    setBenchmarks((benchmarksData as BenchmarkMercado[]) ?? []);
    setEmpresa((empresaData as EmpresaConfig) ?? null);
    setHistorico((historicoData as HistoricoSalarial[]) ?? []);
    setAvaliacoes((discData as AvaliacaoDisc[]) ?? []);
    setEventos((eventosData as EventoRH[]) ?? []);
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
    respostas: { block: number; self: DiscLetter; others: DiscLetter; tempoSelfMs?: number; tempoOthersMs?: number }[];
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
          <Button variant="ghost" onClick={() => setShowEvento(true)}>
            <Plus size={16} /> Registrar evento
          </Button>
          {isRh && !colaborador.data_desligamento && (
            <Button variant="danger" onClick={() => setShowDesligamento(true)}>
              <UserX size={16} /> Desligamento
            </Button>
          )}
          {colaborador.telefone && (
            <a
              href={buildDiscWhatsAppLink(colaborador.telefone, colaborador.nome, `${window.location.origin}/disc/${colaborador.id}`)}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost">
                <MessageCircle size={16} /> Enviar DISC por WhatsApp
              </Button>
            </a>
          )}
          <Button onClick={() => setShowQuiz(true)}>
            <ClipboardCheck size={16} /> Aplicar DISC agora
          </Button>
        </div>
      </div>

      {!colaborador.telefone && (
        <Card className="mb-6 border-[var(--border)] bg-[var(--surface-sunken)] p-4">
          <p className="text-sm text-[var(--ink-muted)]">
            Cadastre o telefone (WhatsApp) deste colaborador em "Editar cadastro" para poder enviar o link do formulário DISC por lá.
          </p>
        </Card>
      )}

      {colaborador.data_desligamento && (
        <Card className="mb-6 border-disc-d/40 bg-disc-dSoft p-4">
          <p className="text-sm font-semibold text-disc-d">
            Desligado em {formatDate(colaborador.data_desligamento)}
            {colaborador.motivo_desligamento ? ` — ${colaborador.motivo_desligamento}` : ""}
          </p>
        </Card>
      )}

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
                  <Link
                    to={`/colaboradores/${colaborador.id}/disc/${a.id}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <FileText size={13} /> Ver relatório completo
                  </Link>
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

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Eventos de RH</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowEvento(true)}>
            <CalendarClock size={15} /> Novo evento
          </Button>
        </div>
        {eventos.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Nenhum evento registrado (férias, faltas, atestados, atrasos, banco de horas, idas ao médico).</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="pb-2 font-semibold">Tipo</th>
                <th className="pb-2 font-semibold">Período</th>
                <th className="pb-2 font-semibold">Qtd.</th>
                <th className="pb-2 font-semibold">Observações</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => (
                <tr key={ev.id} className="border-t border-[var(--border)]">
                  <td className="py-2">
                    <Badge tone={TIPO_EVENTO_TONE[ev.tipo]}>{TIPO_EVENTO_LABEL[ev.tipo]}</Badge>
                  </td>
                  <td className="py-2 text-[var(--ink-muted)]">
                    {formatDate(ev.data_inicio)}
                    {ev.data_fim && ev.data_fim !== ev.data_inicio ? ` – ${formatDate(ev.data_fim)}` : ""}
                  </td>
                  <td className="py-2 font-mono tabular-nums text-[var(--ink-muted)]">
                    {ev.dias != null ? `${ev.dias} dia(s)` : ev.horas != null ? `${ev.horas}h` : "—"}
                  </td>
                  <td className="py-2 text-[var(--ink-muted)]">{ev.observacoes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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

      <NovoEventoModal
        open={showEvento}
        colaboradorId={colaborador.id}
        onClose={() => setShowEvento(false)}
        onSaved={() => {
          setShowEvento(false);
          load();
        }}
      />

      <DesligamentoModal
        open={showDesligamento}
        colaborador={colaborador}
        onClose={() => setShowDesligamento(false)}
        onSaved={() => {
          setShowDesligamento(false);
          load();
        }}
      />
    </div>
  );
}

function NovoEventoModal({
  open,
  colaboradorId,
  onClose,
  onSaved,
}: {
  open: boolean;
  colaboradorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    tipo: "falta" as TipoEventoRH,
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: "",
    horas: "",
    dias: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usaHoras = form.tipo === "atraso" || form.tipo === "banco_horas" || form.tipo === "ida_medico";
  const usaDias = form.tipo === "falta" || form.tipo === "atestado" || form.tipo === "ferias";
  const usaDataFim = form.tipo === "ferias" || form.tipo === "atestado";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("eventos_rh").insert({
      colaborador_id: colaboradorId,
      tipo: form.tipo,
      data_inicio: form.data_inicio,
      data_fim: usaDataFim && form.data_fim ? form.data_fim : null,
      horas: usaHoras && form.horas !== "" ? Number(form.horas) : null,
      dias: usaDias && form.dias !== "" ? Number(form.dias) : null,
      observacoes: form.observacoes,
      registrado_por: user?.id ?? null,
    });
    setSaving(false);
    if (error) setError(error.message);
    else {
      setForm({ tipo: "falta", data_inicio: new Date().toISOString().slice(0, 10), data_fim: "", horas: "", dias: "", observacoes: "" });
      onSaved();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar evento de RH">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Tipo de evento">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoEventoRH })}>
            {(Object.keys(TIPO_EVENTO_LABEL) as TipoEventoRH[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_EVENTO_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de início">
          <Input type="date" required value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
        </Field>
        {usaDataFim && (
          <Field label="Data de fim (opcional)">
            <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </Field>
        )}
        {usaDias && (
          <Field label="Nº de dias">
            <Input type="number" min="0" step="1" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} />
          </Field>
        )}
        {usaHoras && (
          <Field label={form.tipo === "banco_horas" ? "Horas (use negativo para débito)" : "Horas"}>
            <Input type="number" step="0.5" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} />
          </Field>
        )}
        <div className="col-span-2">
          <Field label="Observações">
            <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>
        </div>

        {error && <p className="col-span-2 text-sm text-disc-d">{error}</p>}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Registrar evento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DesligamentoModal({
  open,
  colaborador,
  onClose,
  onSaved,
}: {
  open: boolean;
  colaborador: Colaborador;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dataDesligamento, setDataDesligamento] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("colaboradores")
      .update({ data_desligamento: dataDesligamento, motivo_desligamento: motivo, ativo: false })
      .eq("id", colaborador.id);
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar desligamento">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[var(--ink-muted)]">
          Isso marca <strong>{colaborador.nome}</strong> como inativo e alimenta o cálculo de turnover no período correspondente.
        </p>
        <Field label="Data de desligamento">
          <Input type="date" required value={dataDesligamento} onChange={(e) => setDataDesligamento(e.target.value)} />
        </Field>
        <Field label="Motivo">
          <Input placeholder="Ex.: pedido de demissão, término de contrato, justa causa…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-disc-d">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? "Salvando…" : "Confirmar desligamento"}
          </Button>
        </div>
      </form>
    </Modal>
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
    telefone: colaborador.telefone ?? "",
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
        telefone: form.telefone,
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
          <Field label="Telefone (WhatsApp)">
            <Input placeholder="(11) 91234-5678" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
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
