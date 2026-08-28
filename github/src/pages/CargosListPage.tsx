import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { NIVEIS, formatCurrency } from "@/lib/utils";
import { FACTORS, FACTOR_NAME, type DiscLetter } from "@/data/discWords";
import type { Cargo, FaixaSalarial } from "@/types";

export default function CargosListPage() {
  const { isRh, empresaAtiva } = useAuth();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [faixas, setFaixas] = useState<FaixaSalarial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);

  async function load() {
    setLoading(true);
    // Escopo por empresa ativa (mais registros legados empresa_id null — ver
    // nota em 0004_multiempresa.sql sobre não fazer backfill automático).
    const filtroEmpresa = empresaAtiva ? `empresa_id.eq.${empresaAtiva.id},empresa_id.is.null` : null;
    let cargosQuery = supabase.from("cargos").select("*").order("titulo");
    if (filtroEmpresa) cargosQuery = cargosQuery.or(filtroEmpresa);
    const [{ data: cargosData }, { data: faixasData }] = await Promise.all([
      cargosQuery,
      supabase.from("faixas_salariais").select("*"),
    ]);
    setCargos((cargosData as Cargo[]) ?? []);
    setFaixas((faixasData as FaixaSalarial[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  function faixaDoCargo(cargoId: string) {
    return faixas.filter((f) => f.cargo_id === cargoId).sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1))[0];
  }

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Cargos</h1>
          <p className="text-sm text-[var(--ink-muted)]">Descrição, perfil DISC ideal e faixa salarial de cada cargo.</p>
        </div>
        {isRh && (
          <Button onClick={() => setShowNew(true)}>
            <Plus size={16} /> Novo cargo
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
      ) : cargos.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum cargo cadastrado" description="Cadastre os cargos da empresa para vincular colaboradores e definir faixas salariais." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cargos.map((cargo) => {
            const faixa = faixaDoCargo(cargo.id);
            return (
              <Card key={cargo.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold">{cargo.titulo}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {cargo.area} · {NIVEIS.find((n) => n.value === cargo.nivel)?.label}
                    </p>
                  </div>
                  {isRh && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingCargo(cargo)}>
                      Editar
                    </Button>
                  )}
                </div>
                {cargo.descricao && <p className="text-sm text-[var(--ink-muted)]">{cargo.descricao}</p>}

                <div className="flex flex-wrap gap-1.5">
                  {FACTORS.map((f) => (
                    <Badge key={f} tone="neutral">
                      {f} {cargo[`disc_ideal_${f.toLowerCase()}` as keyof Cargo] as number}%
                    </Badge>
                  ))}
                </div>

                <div className="mt-1 border-t border-[var(--border)] pt-3 text-sm">
                  {faixa ? (
                    <p>
                      Faixa salarial: <b>{formatCurrency(faixa.salario_min)}</b> – <b>{formatCurrency(faixa.salario_max)}</b>{" "}
                      <span className="text-[var(--ink-muted)]">(médio {formatCurrency(faixa.salario_medio)})</span>
                    </p>
                  ) : (
                    <p className="text-[var(--ink-muted)]">Sem faixa salarial cadastrada.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && <CargoModal empresaId={empresaAtiva?.id ?? null} onClose={() => setShowNew(false)} onSaved={load} />}
      {editingCargo && (
        <CargoModal
          cargo={editingCargo}
          empresaId={empresaAtiva?.id ?? null}
          faixaAtual={faixaDoCargo(editingCargo.id)}
          onClose={() => setEditingCargo(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function CargoModal({
  cargo,
  empresaId,
  faixaAtual,
  onClose,
  onSaved,
}: {
  cargo?: Cargo;
  empresaId: string | null;
  faixaAtual?: FaixaSalarial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titulo: cargo?.titulo ?? "",
    area: cargo?.area ?? "",
    nivel: cargo?.nivel ?? "pleno",
    descricao: cargo?.descricao ?? "",
    disc: {
      D: cargo?.disc_ideal_d ?? 50,
      I: cargo?.disc_ideal_i ?? 50,
      S: cargo?.disc_ideal_s ?? 50,
      C: cargo?.disc_ideal_c ?? 50,
    } as Record<DiscLetter, number>,
    salario_min: faixaAtual ? String(faixaAtual.salario_min) : "",
    salario_medio: faixaAtual ? String(faixaAtual.salario_medio) : "",
    salario_max: faixaAtual ? String(faixaAtual.salario_max) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      titulo: form.titulo,
      area: form.area,
      nivel: form.nivel,
      descricao: form.descricao,
      disc_ideal_d: form.disc.D,
      disc_ideal_i: form.disc.I,
      disc_ideal_s: form.disc.S,
      disc_ideal_c: form.disc.C,
    };

    let cargoId = cargo?.id;
    if (cargo) {
      // Na edição não sobrescrevemos empresa_id: evita reatribuir
      // silenciosamente um cargo legado (empresa_id null) para a empresa
      // ativa só porque alguém editou a descrição, por exemplo.
      const { error } = await supabase.from("cargos").update(payload).eq("id", cargo.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from("cargos").insert({ ...payload, empresa_id: empresaId }).select().single();
      if (error || !data) {
        setError(error?.message ?? "Erro ao criar cargo");
        setSaving(false);
        return;
      }
      cargoId = data.id;
    }

    if (cargoId && form.salario_min && form.salario_medio && form.salario_max) {
      const { error: faixaError } = await supabase.from("faixas_salariais").insert({
        cargo_id: cargoId,
        salario_min: Number(form.salario_min),
        salario_medio: Number(form.salario_medio),
        salario_max: Number(form.salario_max),
      });
      if (faixaError) {
        setError(faixaError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={cargo ? "Editar cargo" : "Novo cargo"} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Título do cargo">
            <Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </Field>
          <Field label="Área">
            <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </Field>
          <Field label="Nível">
            <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value as Cargo["nivel"] })}>
              {NIVEIS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descrição do cargo">
          <textarea
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Perfil DISC ideal do cargo</p>
          <div className="grid grid-cols-4 gap-3">
            {FACTORS.map((f) => (
              <div key={f}>
                <label className="mb-1 flex justify-between text-xs text-[var(--ink-muted)]">
                  <span>{f} · {FACTOR_NAME[f]}</span>
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
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Nova faixa salarial (plano de cargos e salários){faixaAtual ? " — cria uma nova versão vigente" : ""}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mínimo (R$)">
              <Input type="number" min="0" step="0.01" value={form.salario_min} onChange={(e) => setForm({ ...form, salario_min: e.target.value })} />
            </Field>
            <Field label="Médio (R$)">
              <Input type="number" min="0" step="0.01" value={form.salario_medio} onChange={(e) => setForm({ ...form, salario_medio: e.target.value })} />
            </Field>
            <Field label="Máximo (R$)">
              <Input type="number" min="0" step="0.01" value={form.salario_max} onChange={(e) => setForm({ ...form, salario_max: e.target.value })} />
            </Field>
          </div>
        </div>

        {error && <p className="text-sm text-disc-d">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar cargo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
