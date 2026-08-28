import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { ESTADOS_BR, NIVEIS, REGIMES, SETORES_SUGERIDOS, buildDiscWhatsAppLink, formatCurrency } from "@/lib/utils";
import type { Cargo, Colaborador } from "@/types";

export default function ColaboradoresListPage() {
  const { isRh, empresaAtiva } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    // Escopo por empresa ativa: mostra os dados da empresa selecionada no
    // menu lateral E também os registros legados (empresa_id null), já que a
    // retrofit multiempresa não faz backfill automático (ver 0004_multiempresa.sql).
    const filtroEmpresa = empresaAtiva ? `empresa_id.eq.${empresaAtiva.id},empresa_id.is.null` : null;
    let colabsQuery = supabase.from("colaboradores").select("*, cargo:cargos(*)").order("nome");
    let cargosQuery = supabase.from("cargos").select("*").order("titulo");
    if (filtroEmpresa) {
      colabsQuery = colabsQuery.or(filtroEmpresa);
      cargosQuery = cargosQuery.or(filtroEmpresa);
    }
    const [{ data: colabs }, { data: cargosData }] = await Promise.all([colabsQuery, cargosQuery]);
    setColaboradores((colabs as Colaborador[]) ?? []);
    setCargos((cargosData as Cargo[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  const filtered = colaboradores.filter(
    (c) =>
      c.nome.toLowerCase().includes(query.toLowerCase()) ||
      c.cargo?.titulo.toLowerCase().includes(query.toLowerCase()) ||
      c.setor.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Colaboradores</h1>
          <p className="text-sm text-[var(--ink-muted)]">{colaboradores.length} cadastrados</p>
        </div>
        {isRh && (
          <Button onClick={() => setShowNew(true)}>
            <Plus size={16} /> Novo colaborador
          </Button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <Search size={16} className="text-[var(--ink-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, cargo ou setor…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--ink-muted)]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum colaborador encontrado" description="Cadastre o primeiro colaborador para começar a acompanhar DISC e plano de cargos e salários." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="px-5 py-3 font-semibold">Nome</th>
                  <th className="px-5 py-3 font-semibold">Cargo</th>
                  <th className="px-5 py-3 font-semibold">Setor</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Regime</th>
                  <th className="px-5 py-3 text-right font-semibold">Salário</th>
                  <th className="px-5 py-3 text-right font-semibold">DISC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-sunken)]">
                    <td className="px-5 py-3">
                      <Link to={`/colaboradores/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{c.cargo?.titulo ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{c.setor || "—"}</td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{c.estado}</td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{c.regime_contratacao}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatCurrency(c.salario_atual)}</td>
                    <td className="px-5 py-3 text-right">
                      {c.telefone ? (
                        <a
                          href={buildDiscWhatsAppLink(c.telefone, c.nome, `${window.location.origin}/disc/${c.id}`)}
                          target="_blank"
                          rel="noreferrer"
                          title="Enviar formulário DISC pelo WhatsApp"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-disc-s"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={17} />
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--ink-muted)]">sem telefone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && (
        <NewColaboradorModal cargos={cargos} empresaId={empresaAtiva?.id ?? null} onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}

function NewColaboradorModal({
  cargos,
  empresaId,
  onClose,
  onCreated,
}: {
  cargos: Cargo[];
  empresaId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cargo_id: cargos[0]?.id ?? "",
    setor: "",
    estado: "SP",
    cidade: "",
    data_admissao: new Date().toISOString().slice(0, 10),
    salario_atual: "",
    regime_contratacao: "CLT",
    nivel: "pleno",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("colaboradores").insert({
      empresa_id: empresaId,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      cargo_id: form.cargo_id || null,
      setor: form.setor,
      estado: form.estado,
      cidade: form.cidade,
      data_admissao: form.data_admissao,
      salario_atual: Number(form.salario_atual) || 0,
      regime_contratacao: form.regime_contratacao,
      nivel: form.nivel,
    });
    setSaving(false);
    if (error) setError(error.message);
    else {
      onCreated();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo colaborador" wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Nome completo">
          <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone (WhatsApp)">
          <Input
            placeholder="(11) 91234-5678"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
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
          <Input
            list="setores-sugeridos"
            placeholder="Ex: Comercial / Vendas"
            value={form.setor}
            onChange={(e) => setForm({ ...form, setor: e.target.value })}
          />
          <datalist id="setores-sugeridos">
            {SETORES_SUGERIDOS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Nível">
          <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
            {NIVEIS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </Select>
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
        <Field label="Data de admissão">
          <Input type="date" required value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
        </Field>
        <Field label="Salário atual (R$)">
          <Input type="number" min="0" step="0.01" required value={form.salario_atual} onChange={(e) => setForm({ ...form, salario_atual: e.target.value })} />
        </Field>

        {error && <p className="col-span-2 text-sm text-disc-d">{error}</p>}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
