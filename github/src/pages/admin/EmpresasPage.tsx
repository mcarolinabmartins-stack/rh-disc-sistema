import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Button, Card, EmptyState, Field, Input, Modal } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import type { Empresa } from "@/types";

// Página visível só para admin_master: cadastro das empresas-cliente que a
// Carolina revende o sistema. Cada empresa criada aqui vira uma "aba" de
// dados isolados (colaboradores, cargos, vagas, etc. escopados por
// empresa_id) — o acesso de cada usuário a essas empresas é concedido em
// /admin/usuarios-acesso.
export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("empresas").select("*").order("nome");
    setEmpresas((data as Empresa[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-[var(--ink-muted)]">Empresas-cliente cadastradas no sistema.</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nova empresa
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
      ) : empresas.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma empresa cadastrada" description="Crie a primeira empresa-cliente para começar a organizar os dados por empresa." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="px-5 py-3 font-semibold">Nome</th>
                  <th className="px-5 py-3 font-semibold">CNPJ</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Criada em</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {empresas.map((emp) => (
                  <tr key={emp.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-sunken)]">
                    <td className="px-5 py-3 font-semibold">{emp.nome}</td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{emp.cnpj || "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={emp.ativo ? "good" : "neutral"}>{emp.ativo ? "Ativa" : "Inativa"}</Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--ink-muted)]">{formatDate(emp.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(emp)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && <EmpresaModal onClose={() => setShowNew(false)} onSaved={load} />}
      {editing && <EmpresaModal empresa={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function EmpresaModal({ empresa, onClose, onSaved }: { empresa?: Empresa; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: empresa?.nome ?? "",
    cnpj: empresa?.cnpj ?? "",
    ativo: empresa?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { nome: form.nome, cnpj: form.cnpj || null, ativo: form.ativo };
    const { error } = empresa
      ? await supabase.from("empresas").update(payload).eq("id", empresa.id)
      : await supabase.from("empresas").insert(payload);
    setSaving(false);
    if (error) setError(error.message);
    else {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={empresa ? "Editar empresa" : "Nova empresa"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nome da empresa">
          <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Field>
        <Field label="CNPJ (opcional)">
          <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Empresa ativa
        </label>

        {error && <p className="text-sm text-disc-d">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
