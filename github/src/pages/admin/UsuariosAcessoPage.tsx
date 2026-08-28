import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Button, Card, Field, Select } from "@/components/ui/primitives";
import type { Empresa, GrupoEmpresas, PapelEmpresa, Profile, UsuarioEmpresa, UsuarioGrupo } from "@/types";

// Página visível só para admin_master: para cada usuário do sistema, decide
// a quais empresas (diretamente) ou grupos de empresas ele tem acesso, e com
// qual papel (RH ou gestor) nas concessões diretas por empresa.
export default function UsuariosAcessoPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresas[]>([]);
  const [acessosEmpresa, setAcessosEmpresa] = useState<UsuarioEmpresa[]>([]);
  const [acessosGrupo, setAcessosGrupo] = useState<UsuarioGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: e }, { data: g }, { data: ae }, { data: ag }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("empresas").select("*").order("nome"),
      supabase.from("grupos_empresas").select("*").order("nome"),
      supabase.from("usuario_empresas").select("*"),
      supabase.from("usuario_grupos").select("*"),
    ]);
    setProfiles((p as Profile[]) ?? []);
    setEmpresas((e as Empresa[]) ?? []);
    setGrupos((g as GrupoEmpresas[]) ?? []);
    setAcessosEmpresa((ae as UsuarioEmpresa[]) ?? []);
    setAcessosGrupo((ag as UsuarioGrupo[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>;

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold">Usuários & Acessos</h1>
        <p className="text-sm text-[var(--ink-muted)]">Conceda ou revogue acesso de cada usuário a uma empresa específica ou a um grupo de empresas.</p>
      </div>

      <div className="flex flex-col gap-3">
        {profiles.map((p) => {
          const acessosDoUsuario = acessosEmpresa.filter((a) => a.user_id === p.id);
          const gruposDoUsuario = acessosGrupo.filter((a) => a.user_id === p.id);
          const aberto = expandido === p.id;
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--ink)]">{p.full_name || p.email}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.role === "admin_master" ? "brand" : p.role === "rh" ? "good" : "neutral"}>
                    {p.role === "admin_master" ? "Admin master" : p.role === "rh" ? "RH (padrão)" : "Gestor(a) (padrão)"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setExpandido(aberto ? null : p.id)}>
                    {aberto ? "Fechar" : "Gerenciar acessos"}
                  </Button>
                </div>
              </div>

              {aberto && (
                <div className="mt-4 flex flex-col gap-5 border-t border-[var(--border)] pt-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Acesso direto a empresas</p>
                    <div className="mb-2 flex flex-col gap-1.5">
                      {acessosDoUsuario.length === 0 ? (
                        <p className="text-sm text-[var(--ink-muted)]">Nenhum acesso direto concedido.</p>
                      ) : (
                        acessosDoUsuario.map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm">
                            <span>
                              {empresas.find((e) => e.id === a.empresa_id)?.nome ?? "—"}{" "}
                              <Badge tone="neutral" className="ml-1">
                                {a.papel === "rh" ? "RH" : "Gestor(a)"}
                              </Badge>
                            </span>
                            <button
                              onClick={async () => {
                                await supabase.from("usuario_empresas").delete().eq("id", a.id);
                                load();
                              }}
                              className="text-[var(--ink-muted)] hover:text-disc-d"
                              aria-label="Revogar"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <NovoAcessoEmpresa userId={p.id} empresas={empresas} jaConcedidas={acessosDoUsuario.map((a) => a.empresa_id)} onSaved={load} />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Acesso via grupos de empresas</p>
                    <div className="mb-2 flex flex-col gap-1.5">
                      {gruposDoUsuario.length === 0 ? (
                        <p className="text-sm text-[var(--ink-muted)]">Nenhum grupo concedido.</p>
                      ) : (
                        gruposDoUsuario.map((a) => (
                          <div key={a.grupo_id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm">
                            <span>{grupos.find((g) => g.id === a.grupo_id)?.nome ?? "—"}</span>
                            <button
                              onClick={async () => {
                                await supabase.from("usuario_grupos").delete().eq("user_id", p.id).eq("grupo_id", a.grupo_id);
                                load();
                              }}
                              className="text-[var(--ink-muted)] hover:text-disc-d"
                              aria-label="Revogar"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <NovoAcessoGrupo userId={p.id} grupos={grupos} jaConcedidos={gruposDoUsuario.map((a) => a.grupo_id)} onSaved={load} />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NovoAcessoEmpresa({
  userId,
  empresas,
  jaConcedidas,
  onSaved,
}: {
  userId: string;
  empresas: Empresa[];
  jaConcedidas: string[];
  onSaved: () => void;
}) {
  const disponiveis = empresas.filter((e) => !jaConcedidas.includes(e.id));
  const [empresaId, setEmpresaId] = useState(disponiveis[0]?.id ?? "");
  const [papel, setPapel] = useState<PapelEmpresa>("rh");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!disponiveis.some((e) => e.id === empresaId)) setEmpresaId(disponiveis[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaConcedidas.join(",")]);

  if (disponiveis.length === 0) return null;

  async function handleAdd() {
    if (!empresaId) return;
    setSaving(true);
    await supabase.from("usuario_empresas").insert({ user_id: userId, empresa_id: empresaId, papel });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Field label="Empresa">
          <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {disponiveis.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="w-32">
        <Field label="Papel">
          <Select value={papel} onChange={(e) => setPapel(e.target.value as PapelEmpresa)}>
            <option value="rh">RH</option>
            <option value="gestor">Gestor(a)</option>
          </Select>
        </Field>
      </div>
      <Button size="sm" onClick={handleAdd} disabled={saving || !empresaId}>
        <Plus size={15} /> Conceder
      </Button>
    </div>
  );
}

function NovoAcessoGrupo({
  userId,
  grupos,
  jaConcedidos,
  onSaved,
}: {
  userId: string;
  grupos: GrupoEmpresas[];
  jaConcedidos: string[];
  onSaved: () => void;
}) {
  const disponiveis = grupos.filter((g) => !jaConcedidos.includes(g.id));
  const [grupoId, setGrupoId] = useState(disponiveis[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!disponiveis.some((g) => g.id === grupoId)) setGrupoId(disponiveis[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaConcedidos.join(",")]);

  if (disponiveis.length === 0) return null;

  async function handleAdd() {
    if (!grupoId) return;
    setSaving(true);
    await supabase.from("usuario_grupos").insert({ user_id: userId, grupo_id: grupoId });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Field label="Grupo de empresas">
          <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            {disponiveis.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button size="sm" onClick={handleAdd} disabled={saving || !grupoId}>
        <Plus size={15} /> Conceder
      </Button>
    </div>
  );
}
