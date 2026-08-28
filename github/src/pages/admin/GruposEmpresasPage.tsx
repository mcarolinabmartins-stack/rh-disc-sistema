import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui/primitives";
import type { Empresa, GrupoEmpresas } from "@/types";

// Página visível só para admin_master: grupos de empresas permitem dar
// acesso a VÁRIAS empresas de uma vez a um usuário (ex.: um consultor que
// atende um conjunto de clientes da Carolina), em vez de conceder empresa
// por empresa em /admin/usuarios-acesso.
export default function GruposEmpresasPage() {
  const [grupos, setGrupos] = useState<GrupoEmpresas[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [membros, setMembros] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<GrupoEmpresas | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: g }, { data: e }, { data: m }] = await Promise.all([
      supabase.from("grupos_empresas").select("*").order("nome"),
      supabase.from("empresas").select("*").order("nome"),
      supabase.from("grupo_empresas_membros").select("*"),
    ]);
    setGrupos((g as GrupoEmpresas[]) ?? []);
    setEmpresas((e as Empresa[]) ?? []);
    const map: Record<string, string[]> = {};
    ((m as { grupo_id: string; empresa_id: string }[]) ?? []).forEach((row) => {
      map[row.grupo_id] = [...(map[row.grupo_id] ?? []), row.empresa_id];
    });
    setMembros(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function empresaNome(id: string) {
    return empresas.find((e) => e.id === id)?.nome ?? "—";
  }

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Grupos de Empresas</h1>
          <p className="text-sm text-[var(--ink-muted)]">Agrupe empresas para conceder acesso a várias de uma vez.</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Novo grupo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
      ) : grupos.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum grupo criado" description="Crie um grupo para dar acesso a várias empresas de uma vez a um usuário." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((grupo) => (
            <Card key={grupo.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-lg font-semibold">{grupo.nome}</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing(grupo)}>
                  Gerenciar empresas
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(membros[grupo.id] ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)]">Nenhuma empresa neste grupo ainda.</p>
                ) : (
                  (membros[grupo.id] ?? []).map((empId) => (
                    <Badge key={empId} tone="brand">
                      {empresaNome(empId)}
                    </Badge>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && <NovoGrupoModal onClose={() => setShowNew(false)} onSaved={load} />}
      {editing && (
        <MembrosModal
          grupo={editing}
          empresas={empresas}
          membrosAtuais={membros[editing.id] ?? []}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function NovoGrupoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("grupos_empresas").insert({ nome });
    setSaving(false);
    if (error) setError(error.message);
    else {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo grupo de empresas">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nome do grupo">
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Clientes Varejo SP" />
        </Field>
        {error && <p className="text-sm text-disc-d">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Criando…" : "Criar grupo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MembrosModal({
  grupo,
  empresas,
  membrosAtuais,
  onClose,
  onSaved,
}: {
  grupo: GrupoEmpresas;
  empresas: Empresa[];
  membrosAtuais: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>(membrosAtuais);
  const [addId, setAddId] = useState(empresas.find((e) => !membrosAtuais.includes(e.id))?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponiveis = empresas.filter((e) => !selecionadas.includes(e.id));

  async function handleAdd() {
    if (!addId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("grupo_empresas_membros").insert({ grupo_id: grupo.id, empresa_id: addId });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelecionadas((s) => [...s, addId]);
    setAddId(disponiveis.find((e) => e.id !== addId)?.id ?? "");
    onSaved();
  }

  async function handleRemove(empresaId: string) {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("grupo_empresas_membros")
      .delete()
      .eq("grupo_id", grupo.id)
      .eq("empresa_id", empresaId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelecionadas((s) => s.filter((id) => id !== empresaId));
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`Empresas em "${grupo.nome}"`} wide>
      <div className="mb-4 flex flex-col gap-2">
        {selecionadas.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Nenhuma empresa neste grupo ainda.</p>
        ) : (
          selecionadas.map((empId) => (
            <div key={empId} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm">
              <span>{empresas.find((e) => e.id === empId)?.nome ?? "—"}</span>
              <button onClick={() => handleRemove(empId)} className="text-[var(--ink-muted)] hover:text-disc-d" aria-label="Remover" disabled={saving}>
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {disponiveis.length > 0 && (
        <div className="flex items-end gap-2 border-t border-[var(--border)] pt-4">
          <div className="flex-1">
            <Field label="Adicionar empresa">
              <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
                {disponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={handleAdd} disabled={saving || !addId}>
            <Plus size={15} /> Adicionar
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-disc-d">{error}</p>}

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}
