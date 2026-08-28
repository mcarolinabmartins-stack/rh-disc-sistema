import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/utils";
import { DiscQuizFlow, type DiscQuizResult } from "@/components/disc/DiscQuizFlow";

interface VagaPublica {
  id: string;
  titulo: string;
  descricao_atividades: string;
  requisitos: string;
  salario: string;
  beneficios: string;
  disc_ideal_d: number;
  disc_ideal_i: number;
  disc_ideal_s: number;
  disc_ideal_c: number;
  status: string;
}

// Página pública, sem necessidade de login — link enviado ao candidato para
// se candidatar a uma vaga: envia currículo + contato e faz o teste DISC,
// que é comparado ao perfil ideal (editável) definido pela vaga.
export default function VagaCandidaturaPublicaPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [vaga, setVaga] = useState<VagaPublica | null>(null);
  const [etapa, setEtapa] = useState<"dados" | "disc">("dados");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_vaga_publica_candidatura", { p_token: token }).maybeSingle();
      if (error || !data) {
        setErro("Não encontramos essa vaga. Ela pode ter sido encerrada ou o link está incompleto.");
      } else {
        setVaga(data as VagaPublica);
      }
      setLoading(false);
    })();
  }, [token]);

  function handleAvancar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setEtapa("disc");
  }

  async function handleSave(result: DiscQuizResult) {
    if (!token || !vaga) return;
    setSaving(true);

    // Upload do currículo é opcional e degrada graciosamente: se o bucket
    // "curriculos" ainda não existir neste projeto Supabase (ver comentário
    // na migration 0005_vagas.sql), simplesmente seguimos sem o arquivo em
    // vez de bloquear o envio da candidatura.
    let curriculoPath: string | null = null;
    if (arquivo) {
      try {
        const nomeArquivo = `${Date.now()}-${arquivo.name}`.replace(/[^\w.\-]/g, "_");
        const path = `vagas/${vaga.id}/${nomeArquivo}`;
        const { error: uploadError } = await supabase.storage.from("curriculos").upload(path, arquivo);
        if (!uploadError) curriculoPath = path;
      } catch {
        // segue sem currículo
      }
    }

    const { error } = await supabase.rpc("submit_candidatura", {
      p_token: token,
      p_nome: nome,
      p_telefone: telefone || null,
      p_email: email || null,
      p_curriculo_path: curriculoPath,
      p_disc_norm: result.norm,
      p_disc_self_pct: result.selfPct,
      p_disc_others_pct: result.othersPct,
      p_respostas: result.respostas,
    });
    setSaving(false);
    if (error) {
      setErro("Não foi possível enviar sua candidatura agora. Tente novamente em alguns instantes.");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[var(--surface-sunken)] px-4 py-10">
      <Card className="w-full max-w-2xl p-6 sm:p-8">
        {loading && <p className="text-center text-sm text-[var(--ink-muted)]">Carregando…</p>}

        {!loading && erro && <p className="text-center text-sm text-disc-d">{erro}</p>}

        {!loading && !erro && vaga && (
          <>
            <div className="mb-6 text-center">
              <p className="font-display text-xl font-semibold">{vaga.titulo}</p>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">Candidatura + avaliação de perfil comportamental (DISC)</p>
            </div>

            {etapa === "dados" && !saved && (
              <>
                <div className="mb-6 flex flex-col gap-3 rounded-xl bg-[var(--surface-sunken)] p-4 text-sm">
                  {vaga.descricao_atividades && (
                    <div>
                      <p className="font-semibold text-[var(--ink)]">Atividades</p>
                      <p className="whitespace-pre-line text-[var(--ink-muted)]">{vaga.descricao_atividades}</p>
                    </div>
                  )}
                  {vaga.requisitos && (
                    <div>
                      <p className="font-semibold text-[var(--ink)]">Requisitos</p>
                      <p className="whitespace-pre-line text-[var(--ink-muted)]">{vaga.requisitos}</p>
                    </div>
                  )}
                  {vaga.salario && (
                    <div>
                      <p className="font-semibold text-[var(--ink)]">Salário</p>
                      <p className="text-[var(--ink-muted)]">{isFinite(Number(vaga.salario)) && vaga.salario ? formatCurrency(Number(vaga.salario)) : vaga.salario}</p>
                    </div>
                  )}
                  {vaga.beneficios && (
                    <div>
                      <p className="font-semibold text-[var(--ink)]">Benefícios</p>
                      <p className="whitespace-pre-line text-[var(--ink-muted)]">{vaga.beneficios}</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAvancar} className="flex flex-col gap-4">
                  <Field label="Nome completo">
                    <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </Field>
                  <Field label="Telefone (WhatsApp)">
                    <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 91234-5678" />
                  </Field>
                  <Field label="E-mail">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field label="Currículo (PDF, opcional)">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-brand-700 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                  </Field>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Depois dos seus dados, você vai fazer uma avaliação rápida de perfil comportamental (DISC) — leva uns 5 minutos.
                  </p>
                  <Button type="submit">Continuar para a avaliação DISC →</Button>
                </form>
              </>
            )}

            {etapa === "disc" && (
              <DiscQuizFlow
                active
                cargoTitulo={vaga.titulo}
                cargoIdeal={{
                  disc_ideal_d: vaga.disc_ideal_d,
                  disc_ideal_i: vaga.disc_ideal_i,
                  disc_ideal_s: vaga.disc_ideal_s,
                  disc_ideal_c: vaga.disc_ideal_c,
                }}
                saving={saving}
                saved={saved}
                savedMessage="Sua candidatura foi enviada com sucesso! A equipe de RH vai analisar seu perfil e entrar em contato se houver compatibilidade com a vaga."
                onSave={handleSave}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
