import { useEffect, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { buildClimaWhatsAppLink, formatDate } from "@/lib/utils";
import { calcEnps, ENPS_AMOSTRA_MINIMA_CONFIAVEL } from "@/lib/rhIndicadores";
import type { Colaborador, PesquisaResposta, PesquisaRodada, TipoPesquisa } from "@/types";

export default function PesquisaClimaAdminPage() {
  const [rodadas, setRodadas] = useState<PesquisaRodada[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [respostasPorRodada, setRespostasPorRodada] = useState<Record<string, PesquisaResposta[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [rodadaSelecionada, setRodadaSelecionada] = useState<string | null>(null);
  const [showEnvio, setShowEnvio] = useState(false);

  async function load() {
    // TODO: filtrar por empresa_id (empresaAtiva do AuthContext) — hoje esta
    // página ainda lê rodadas/colaboradores de todas as empresas às quais o
    // usuário tem acesso via RLS, sem restringir à empresa selecionada no
    // menu lateral, ao contrário de ColaboradoresListPage/CargosListPage/VagasPage.
    setLoading(true);
    const [{ data: rod }, { data: colabs }] = await Promise.all([
      supabase.from("pesquisa_rodadas").select("*").order("data_abertura", { ascending: false }),
      supabase.from("colaboradores").select("*").eq("ativo", true).order("nome"),
    ]);
    const rodadasData = (rod as PesquisaRodada[]) ?? [];
    setRodadas(rodadasData);
    setColaboradores((colabs as Colaborador[]) ?? []);

    const respostas: Record<string, PesquisaResposta[]> = {};
    await Promise.all(
      rodadasData.map(async (r) => {
        const { data } = await supabase.from("pesquisa_respostas").select("*").eq("rodada_id", r.id);
        respostas[r.id] = (data as PesquisaResposta[]) ?? [];
      })
    );
    setRespostasPorRodada(respostas);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const rodadaAberta = rodadas.find((r) => r.id === rodadaSelecionada);

  if (loading) return <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>;

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Pesquisa de clima & eNPS</h1>
          <p className="text-sm text-[var(--ink-muted)]">Rodadas biannuais, envio manual por WhatsApp, respostas sempre anônimas.</p>
        </div>
        <Button onClick={() => setShowNova(true)}>
          <Plus size={16} /> Nova rodada
        </Button>
      </div>

      {rodadas.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="Nenhuma rodada criada ainda" description="Crie a primeira rodada (clima ou eNPS) para começar a enviar convites por WhatsApp." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rodadas.map((r) => {
            const respostas = respostasPorRodada[r.id] ?? [];
            const enps = r.tipo === "enps" ? calcEnps(respostas) : null;
            return (
              <Card key={r.id} className="p-6">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">{r.rotulo || "(sem rótulo)"}</h2>
                      <Badge tone={r.tipo === "enps" ? "brand" : "neutral"}>{r.tipo === "enps" ? "eNPS" : "Clima"}</Badge>
                      <Badge tone={r.ativo ? "good" : "neutral"}>{r.ativo ? "Ativa" : "Encerrada"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">{r.pergunta_principal}</p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      Aberta em {formatDate(r.data_abertura)}
                      {r.data_fechamento ? ` · encerrada em ${formatDate(r.data_fechamento)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRodadaSelecionada(r.id);
                        setShowEnvio(true);
                      }}
                    >
                      <MessageCircle size={15} /> Enviar convites
                    </Button>
                    {r.ativo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await supabase.from("pesquisa_rodadas").update({ ativo: false, data_fechamento: new Date().toISOString().slice(0, 10) }).eq("id", r.id);
                          load();
                        }}
                      >
                        Encerrar rodada
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                    Resultado agregado — {respostas.length} resposta(s) anônima(s)
                  </p>
                  {respostas.length === 0 ? (
                    <p className="text-sm text-[var(--ink-muted)]">Sem dados suficientes ainda.</p>
                  ) : r.tipo === "enps" && enps ? (
                    <div className="flex items-center gap-4">
                      <p className="font-display text-2xl font-semibold">{enps.valor.toFixed(0)}</p>
                      {enps.amostra < ENPS_AMOSTRA_MINIMA_CONFIAVEL && (
                        <Badge tone="warn">Amostra baixa ({enps.amostra}) — leia com cautela</Badge>
                      )}
                    </div>
                  ) : (
                    <ClimaResumo respostas={respostas} />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showNova && (
        <NovaRodadaModal
          onClose={() => setShowNova(false)}
          onSaved={() => {
            setShowNova(false);
            load();
          }}
        />
      )}

      {showEnvio && rodadaAberta && (
        <EnvioConvitesModal rodada={rodadaAberta} colaboradores={colaboradores} onClose={() => setShowEnvio(false)} />
      )}
    </div>
  );
}

// Resumo simples de clima: para cada dimensão presente nas respostas,
// mostra a média das notas informadas. Puramente agregado — nunca
// individualiza por colaborador (não há como, a resposta não guarda quem respondeu).
function ClimaResumo({ respostas }: { respostas: PesquisaResposta[] }) {
  const somas: Record<string, { total: number; qtd: number }> = {};
  for (const r of respostas) {
    const scores = r.respostas?.scores ?? {};
    for (const [dim, nota] of Object.entries(scores)) {
      if (typeof nota !== "number") continue;
      if (!somas[dim]) somas[dim] = { total: 0, qtd: 0 };
      somas[dim].total += nota;
      somas[dim].qtd += 1;
    }
  }
  const dims = Object.entries(somas);
  if (dims.length === 0) return <p className="text-sm text-[var(--ink-muted)]">Sem dados suficientes.</p>;
  return (
    <div className="flex flex-col gap-2">
      {dims.map(([dim, { total, qtd }]) => (
        <div key={dim} className="flex items-center justify-between text-sm">
          <span className="capitalize text-[var(--ink-muted)]">{dim}</span>
          <span className="font-mono font-semibold tabular-nums">{(total / qtd).toFixed(1)} / 5</span>
        </div>
      ))}
    </div>
  );
}

function NovaRodadaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ tipo: "clima" as TipoPesquisa, rotulo: "", pergunta_principal: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("pesquisa_rodadas").insert({
      tipo: form.tipo,
      rotulo: form.rotulo,
      pergunta_principal: form.pergunta_principal,
    });
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Nova rodada de pesquisa">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoPesquisa })}>
            <option value="clima">Clima organizacional</option>
            <option value="enps">eNPS</option>
          </Select>
        </Field>
        <Field label="Rótulo (ex.: 2026-S1)">
          <Input required value={form.rotulo} onChange={(e) => setForm({ ...form, rotulo: e.target.value })} />
        </Field>
        <Field label="Pergunta principal">
          <Input
            required
            placeholder={form.tipo === "enps" ? "De 0 a 10, quanto você recomendaria a empresa como lugar para trabalhar?" : "Como você avalia o clima de trabalho hoje?"}
            value={form.pergunta_principal}
            onChange={(e) => setForm({ ...form, pergunta_principal: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-disc-d">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Criando…" : "Criar rodada"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EnvioConvitesModal({ rodada, colaboradores, onClose }: { rodada: PesquisaRodada; colaboradores: Colaborador[]; onClose: () => void }) {
  const linkBase = `${window.location.origin}/clima/${rodada.id}`;
  return (
    <Modal open onClose={onClose} title={`Enviar convites — ${rodada.rotulo}`} wide>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        Cada botão abre o WhatsApp com uma mensagem pronta contendo o link anônimo da pesquisa. O envio é manual, colaborador por colaborador — não há disparo em massa.
      </p>
      {colaboradores.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Nenhum colaborador ativo cadastrado.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="pb-2 font-semibold">Colaborador</th>
                <th className="pb-2 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{c.nome}</td>
                  <td className="py-2 text-right">
                    {c.telefone ? (
                      <a href={buildClimaWhatsAppLink(c.telefone, c.nome, linkBase)} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost">
                          <MessageCircle size={14} /> Enviar via WhatsApp
                        </Button>
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--ink-muted)]">Sem telefone cadastrado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}
