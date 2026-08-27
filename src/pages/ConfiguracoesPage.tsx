import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { ESTADOS_BR, REGIMES, formatCurrency, formatDate } from "@/lib/utils";
import type { BenchmarkMercado, Cargo, EmpresaConfig, Profile } from "@/types";

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-[var(--ink-muted)]">Dados da empresa, benchmarks de mercado e acessos.</p>
      </div>
      <EmpresaSection />
      <BenchmarksSection />
      <UsuariosSection />
    </div>
  );
}

function EmpresaSection() {
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("empresa_config")
      .select("*")
      .single()
      .then(({ data }) => setEmpresa(data as EmpresaConfig));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa) return;
    setSaving(true);
    await supabase
      .from("empresa_config")
      .update({ nome_empresa: empresa.nome_empresa, ramo_atuacao: empresa.ramo_atuacao })
      .eq("id", 1);
    setSaving(false);
  }

  if (!empresa) return null;

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold">Empresa</h2>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        O ramo de atuação é usado para encontrar o benchmark de mercado mais específico para cada colaborador.
      </p>
      <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
        <Field label="Nome da empresa">
          <Input value={empresa.nome_empresa} onChange={(e) => setEmpresa({ ...empresa, nome_empresa: e.target.value })} />
        </Field>
        <Field label="Ramo de atuação">
          <Input
            placeholder="Ex: Varejo, Tecnologia, Indústria…"
            value={empresa.ramo_atuacao}
            onChange={(e) => setEmpresa({ ...empresa, ramo_atuacao: e.target.value })}
          />
        </Field>
        <div className="col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BenchmarksSection() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkMercado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from("benchmarks_mercado").select("*").order("data_referencia", { ascending: false }),
      supabase.from("cargos").select("*").order("titulo"),
    ]);
    setBenchmarks((b as BenchmarkMercado[]) ?? []);
    setCargos((c as Cargo[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await supabase.from("benchmarks_mercado").delete().eq("id", id);
    load();
  }

  function cargoTitulo(cargoId: string) {
    return cargos.find((c) => c.id === cargoId)?.titulo ?? "—";
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Benchmarks de mercado</h2>
          <p className="text-sm text-[var(--ink-muted)]">Faixas salariais de mercado por cargo, estado, ramo de atuação e regime (CLT/PJ).</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={15} /> Novo benchmark
        </Button>
      </div>

      {benchmarks.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Nenhum benchmark cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="py-2 font-semibold">Cargo</th>
                <th className="py-2 font-semibold">UF</th>
                <th className="py-2 font-semibold">Ramo</th>
                <th className="py-2 font-semibold">Regime</th>
                <th className="py-2 text-right font-semibold">Faixa</th>
                <th className="py-2 font-semibold">Referência</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{cargoTitulo(b.cargo_id)}</td>
                  <td className="py-2">{b.estado}</td>
                  <td className="py-2 text-[var(--ink-muted)]">{b.ramo_atuacao || "—"}</td>
                  <td className="py-2">
                    <Badge tone="brand">{b.regime_contratacao}</Badge>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {formatCurrency(b.salario_min)} – {formatCurrency(b.salario_max)}
                  </td>
                  <td className="py-2 text-[var(--ink-muted)]">{formatDate(b.data_referencia)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(b.id)} className="text-[var(--ink-muted)] hover:text-disc-d" aria-label="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <BenchmarkModal cargos={cargos} onClose={() => setShowNew(false)} onSaved={load} />}
    </Card>
  );
}

function BenchmarkModal({ cargos, onClose, onSaved }: { cargos: Cargo[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    cargo_id: cargos[0]?.id ?? "",
    estado: "SP",
    ramo_atuacao: "",
    regime_contratacao: "CLT",
    salario_min: "",
    salario_medio: "",
    salario_max: "",
    fonte: "",
    data_referencia: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("benchmarks_mercado").insert({
      cargo_id: form.cargo_id,
      estado: form.estado,
      ramo_atuacao: form.ramo_atuacao,
      regime_contratacao: form.regime_contratacao,
      salario_min: Number(form.salario_min),
      salario_medio: Number(form.salario_medio),
      salario_max: Number(form.salario_max),
      fonte: form.fonte,
      data_referencia: form.data_referencia,
    });
    setSaving(false);
    if (error) setError(error.message);
    else {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm">
      <Card className="w-full max-w-xl p-6">
        <h2 className="mb-5 font-display text-xl font-semibold">Novo benchmark de mercado</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <Field label="Cargo">
            <Select value={form.cargo_id} onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
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
          <Field label="Ramo de atuação">
            <Input placeholder="Ex: Varejo" value={form.ramo_atuacao} onChange={(e) => setForm({ ...form, ramo_atuacao: e.target.value })} />
          </Field>
          <Field label="Regime de contratação">
            <Select value={form.regime_contratacao} onChange={(e) => setForm({ ...form, regime_contratacao: e.target.value })}>
              {REGIMES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mínimo (R$)">
            <Input type="number" min="0" step="0.01" required value={form.salario_min} onChange={(e) => setForm({ ...form, salario_min: e.target.value })} />
          </Field>
          <Field label="Médio (R$)">
            <Input type="number" min="0" step="0.01" required value={form.salario_medio} onChange={(e) => setForm({ ...form, salario_medio: e.target.value })} />
          </Field>
          <Field label="Máximo (R$)">
            <Input type="number" min="0" step="0.01" required value={form.salario_max} onChange={(e) => setForm({ ...form, salario_max: e.target.value })} />
          </Field>
          <Field label="Data de referência">
            <Input type="date" value={form.data_referencia} onChange={(e) => setForm({ ...form, data_referencia: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Fonte da pesquisa">
              <Input placeholder="Ex: Pesquisa salarial XYZ 2026" value={form.fonte} onChange={(e) => setForm({ ...form, fonte: e.target.value })} />
            </Field>
          </div>

          {error && <p className="col-span-2 text-sm text-disc-d">{error}</p>}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Adicionar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function UsuariosSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setProfiles((data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(p: Profile) {
    await supabase.from("profiles").update({ role: p.role === "rh" ? "gestor" : "rh" }).eq("id", p.id);
    load();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold">Usuários e permissões</h2>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        RH tem acesso completo. Gestores só veem e avaliam os colaboradores vinculados a eles (campo "gestor" no cadastro do colaborador).
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            <th className="py-2 font-semibold">Nome</th>
            <th className="py-2 font-semibold">E-mail</th>
            <th className="py-2 font-semibold">Papel</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t border-[var(--border)]">
              <td className="py-2">{p.full_name || "—"}</td>
              <td className="py-2 text-[var(--ink-muted)]">{p.email}</td>
              <td className="py-2">
                <Badge tone={p.role === "rh" ? "brand" : "neutral"}>{p.role === "rh" ? "RH" : "Gestor(a)"}</Badge>
              </td>
              <td className="py-2 text-right">
                <Button size="sm" variant="ghost" onClick={() => toggleRole(p)}>
                  Tornar {p.role === "rh" ? "Gestor(a)" : "RH"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
