import { useEffect, useState } from "react";
import { Copy, Plus, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { FACTORS, FACTOR_NAME, type DiscLetter } from "@/data/discWords";
import { sugerirDiscIdealParaVaga } from "@/lib/vagaDiscSugestao";
import type { Candidato, StatusVaga, Vaga } from "@/types";

const STATUS_LABEL: Record<StatusVaga, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

const STATUS_TONE: Record<StatusVaga, "neutral" | "good" | "warn" | "bad"> = {
  rascunho: "neutral",
  aberta: "good",
  pausada: "warn",
  encerrada: "bad",
};

export default function VagasPage() {
  const { empresaAtiva, empresasAcessiveis } = useAuth();
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidatosPorVaga, setCandidatosPorVaga] = useState<Record<string, Candidato[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Vaga | null>(null);

  async function load() {
    if (!empresaAtiva) {
      setVagas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("vagas").select("*").eq("empresa_id", empresaAtiva.id).order("created_at", { ascending: false });
    const vagasData = (data as Vaga[]) ?? [];
    setVagas(vagasData);

    const candidatos: Record<string, Candidato[]> = {};
    await Promise.all(
      vagasData.map(async (v) => {
        const { data: cs } = await supabase
          .from("candidatos")
          .select("*")
          .eq("vaga_id", v.id)
          .order("compatibilidade_percentual", { ascending: false });
        candidatos[v.id] = (cs as Candidato[]) ?? [];
      })
    );
    setCandidatosPorVaga(candidatos);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  if (empresasAcessiveis.length > 0 && !empresaAtiva) {
    return (
      <Card className="p-6">
        <EmptyState title="Selecione uma empresa" description="Escolha a empresa ativa no menu lateral para ver as vagas dela." />
      </Card>
    );
  }

  if (empresasAcessiveis.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Nenhuma empresa disponível"
          description="Seu usuário ainda não tem acesso a nenhuma empresa. Peça ao admin master para conceder acesso em Usuários & Acessos."
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Vagas</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {empresaAtiva?.nome} · {vagas.length} vaga(s)
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nova vaga
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
      ) : vagas.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma vaga aberta ainda" description="Crie a primeira vaga para gerar os links públicos de candidatura e de preenchimento pela empresa-cliente." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {vagas.map((vaga) => (
            <VagaCard key={vaga.id} vaga={vaga} candidatos={candidatosPorVaga[vaga.id] ?? []} onEdit={() => setEditing(vaga)} onChanged={load} />
          ))}
        </div>
      )}

      {showNew && empresaAtiva && (
        <VagaModal
          empresaId={empresaAtiva.id}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      {editing && empresaAtiva && (
        <VagaModal
          empresaId={empresaAtiva.id}
          vaga={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function VagaCard({
  vaga,
  candidatos,
  onEdit,
  onChanged,
}: {
  vaga: Vaga;
  candidatos: Candidato[];
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [copiado, setCopiado] = useState<"candidatura" | "preenchimento" | null>(null);
  const linkCandidatura = `${window.location.origin}/vaga/${vaga.token_candidatura}/candidatar`;
  const linkPreenchimento = `${window.location.origin}/vaga/${vaga.token_preenchimento}/preencher`;

  async function copiar(tipo: "candidatura" | "preenchimento") {
    const link = tipo === "candidatura" ? linkCandidatura : linkPreenchimento;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // clipboard indisponível — silenciosamente ignora, o link continua visível para copiar manualmente
    }
  }

  async function baixarCurriculo(candidato: Candidato) {
    if (!candidato.curriculo_path) return;
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(candidato.curriculo_path, 60 * 5);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{vaga.titulo}</h2>
            <Badge tone={STATUS_TONE[vaga.status]}>{STATUS_LABEL[vaga.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Criada em {formatDate(vaga.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={vaga.status}
            onChange={async (e) => {
              await supabase.from("vagas").update({ status: e.target.value }).eq("id", vaga.id);
              onChanged();
            }}
            className="w-36"
          >
            {(Object.keys(STATUS_LABEL) as StatusVaga[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FACTORS.map((f) => (
          <Badge key={f} tone="neutral">
            {f} {vaga[`disc_ideal_${f.toLowerCase()}` as keyof Vaga] as number}%
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:gap-4">
        <button
          onClick={() => copiar("candidatura")}
          className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-left text-sm hover:bg-[var(--surface-sunken)]"
        >
          <Copy size={15} className="flex-none text-[var(--ink-muted)]" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Link para o candidato</span>
            <span className="block truncate text-xs text-[var(--ink-muted)]">{linkCandidatura}</span>
          </span>
          {copiado === "candidatura" && <span className="flex-none text-xs font-semibold text-disc-s">Copiado!</span>}
        </button>
        <button
          onClick={() => copiar("preenchimento")}
          className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-left text-sm hover:bg-[var(--surface-sunken)]"
        >
          <Copy size={15} className="flex-none text-[var(--ink-muted)]" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Link para a empresa-cliente preencher a vaga</span>
            <span className="block truncate text-xs text-[var(--ink-muted)]">{linkPreenchimento}</span>
          </span>
          {copiado === "preenchimento" && <span className="flex-none text-xs font-semibold text-disc-s">Copiado!</span>}
        </button>
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          <Users size={13} /> Candidatos ({candidatos.length}) — ordenados por aderência DISC
        </p>
        {candidatos.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Nenhum candidato ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="py-2 font-semibold">Nome</th>
                  <th className="py-2 font-semibold">Contato</th>
                  <th className="py-2 text-right font-semibold">Aderência</th>
                  <th className="py-2 text-right font-semibold">Currículo</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="py-2">{c.nome}</td>
                    <td className="py-2 text-[var(--ink-muted)]">{c.telefone || c.email || "—"}</td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums">
                      {c.compatibilidade_percentual != null ? `${c.compatibilidade_percentual}%` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {c.curriculo_path ? (
                        <Button size="sm" variant="ghost" onClick={() => baixarCurriculo(c)}>
                          Baixar
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--ink-muted)]">sem arquivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function VagaModal({
  empresaId,
  vaga,
  onClose,
  onSaved,
}: {
  empresaId: string;
  vaga?: Vaga;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titulo: vaga?.titulo ?? "",
    descricao_atividades: vaga?.descricao_atividades ?? "",
    requisitos: vaga?.requisitos ?? "",
    salario: vaga?.salario ?? "",
    beneficios: vaga?.beneficios ?? "",
    status: vaga?.status ?? ("rascunho" as StatusVaga),
    disc: {
      D: vaga?.disc_ideal_d ?? 25,
      I: vaga?.disc_ideal_i ?? 25,
      S: vaga?.disc_ideal_s ?? 25,
      C: vaga?.disc_ideal_c ?? 25,
    } as Record<DiscLetter, number>,
  });
  const [sugestaoInfo, setSugestaoInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSugerir() {
    const sugestao = sugerirDiscIdealParaVaga(form.titulo, form.descricao_atividades, form.requisitos);
    setForm((f) => ({ ...f, disc: { D: sugestao.d, I: sugestao.i, S: sugestao.s, C: sugestao.c } }));
    setSugestaoInfo(
      sugestao.cargoReferencia ? `Cargo de referência: ${sugestao.cargoReferencia}. ${sugestao.aderenciaTexto}` : sugestao.aderenciaTexto
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      empresa_id: empresaId,
      titulo: form.titulo,
      descricao_atividades: form.descricao_atividades,
      requisitos: form.requisitos,
      salario: form.salario,
      beneficios: form.beneficios,
      status: form.status,
      disc_ideal_d: form.disc.D,
      disc_ideal_i: form.disc.I,
      disc_ideal_s: form.disc.S,
      disc_ideal_c: form.disc.C,
    };
    const { error } = vaga ? await supabase.from("vagas").update(payload).eq("id", vaga.id) : await supabase.from("vagas").insert(payload);
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={vaga ? "Editar vaga" : "Nova vaga"} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Título da vaga">
            <Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Analista Financeiro" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusVaga })}>
              {(Object.keys(STATUS_LABEL) as StatusVaga[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descrição das atividades">
          <textarea
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            rows={3}
            value={form.descricao_atividades}
            onChange={(e) => setForm({ ...form, descricao_atividades: e.target.value })}
          />
        </Field>

        <Field label="Requisitos">
          <textarea
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            rows={3}
            value={form.requisitos}
            onChange={(e) => setForm({ ...form, requisitos: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Salário (texto livre)">
            <Input value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} placeholder="Ex: R$ 3.500 a R$ 4.500 ou A combinar" />
          </Field>
          <Field label="Benefícios">
            <Input value={form.beneficios} onChange={(e) => setForm({ ...form, beneficios: e.target.value })} placeholder="Ex: VT, VR, plano de saúde" />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Perfil DISC ideal da vaga (editável)</p>
            <Button type="button" size="sm" variant="ghost" onClick={handleSugerir}>
              <Sparkles size={14} /> Sugerir perfil DISC
            </Button>
          </div>
          {sugestaoInfo && <p className="mb-2 text-xs text-[var(--ink-muted)]">{sugestaoInfo}</p>}
          <div className="grid grid-cols-4 gap-3">
            {FACTORS.map((f) => (
              <div key={f}>
                <label className="mb-1 flex justify-between text-xs text-[var(--ink-muted)]">
                  <span>
                    {f} · {FACTOR_NAME[f]}
                  </span>
                  <span className="font-mono tabular-nums">{form.disc[f]}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.disc[f]}
                  onChange={(e) => setForm({ ...form, disc: { ...form.disc, [f]: Number(e.target.value) } })}
                  className="w-full accent-brand-700"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            Sugestão calculada por heurística de texto contra uma base curada de cargos — não é gerada por IA. Sempre revise antes de publicar.
          </p>
        </div>

        {error && <p className="text-sm text-disc-d">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar vaga"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
