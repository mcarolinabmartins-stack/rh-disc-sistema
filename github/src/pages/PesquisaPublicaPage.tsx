import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card } from "@/components/ui/primitives";

interface RodadaPublica {
  tipo: "clima" | "enps";
  rotulo: string;
  pergunta_principal: string;
  ativo: boolean;
}

const DIMENSOES_CLIMA = [
  { key: "lideranca", label: "Confio na liderança direta" },
  { key: "reconhecimento", label: "Sinto-me reconhecido(a) pelo meu trabalho" },
  { key: "equilibrio", label: "Tenho equilíbrio entre vida pessoal e trabalho" },
  { key: "comunicacao", label: "A comunicação interna é clara" },
  { key: "crescimento", label: "Vejo oportunidades de crescimento aqui" },
];

// Página pública, sem necessidade de login — para onde aponta o link
// enviado manualmente por WhatsApp pelo RH. A resposta é 100% anônima:
// nenhum identificador do colaborador é enviado ou armazenado.
export default function PesquisaPublicaPage() {
  const { rodadaId } = useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rodada, setRodada] = useState<RodadaPublica | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [nota, setNota] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!rodadaId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_rodada_pesquisa_publica", { p_rodada_id: rodadaId }).maybeSingle();
      if (error || !data || !(data as RodadaPublica).ativo) {
        setErro("Este link de pesquisa não está mais disponível. Se você acha que isso é um engano, peça um novo link ao RH.");
      } else {
        setRodada(data as RodadaPublica);
      }
      setLoading(false);
    })();
  }, [rodadaId]);

  async function handleSubmit() {
    if (!rodadaId || !rodada) return;
    setSaving(true);
    const respostas =
      rodada.tipo === "enps" ? { nota, comentario } : { scores, comentario };
    const { error } = await supabase.rpc("submit_pesquisa_publica", {
      p_rodada_id: rodadaId,
      p_respostas: respostas,
    });
    setSaving(false);
    if (error) {
      setErro("Não foi possível enviar sua resposta agora. Tente novamente em alguns instantes.");
      return;
    }
    setSaved(true);
  }

  const podeEnviar = rodada?.tipo === "enps" ? nota != null : Object.keys(scores).length === DIMENSOES_CLIMA.length;

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[var(--surface-sunken)] px-4 py-10">
      <Card className="w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <p className="font-display text-xl font-semibold">{rodada?.tipo === "enps" ? "Pesquisa eNPS" : "Pesquisa de Clima Organizacional"}</p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)]">
            <ShieldCheck size={14} /> 100% anônima — sua resposta não é vinculada a você
          </div>
        </div>

        {loading && <p className="text-center text-sm text-[var(--ink-muted)]">Carregando…</p>}
        {!loading && erro && <p className="text-center text-sm text-disc-d">{erro}</p>}

        {!loading && !erro && rodada && !saved && (
          <div className="flex flex-col gap-6">
            <p className="text-center text-sm text-[var(--ink-muted)]">{rodada.pergunta_principal}</p>

            {rodada.tipo === "enps" ? (
              <div>
                <div className="grid grid-cols-11 gap-1.5">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNota(n)}
                      className={
                        "rounded-lg border py-2.5 text-sm font-semibold transition " +
                        (nota === n ? "border-brand-700 bg-brand-700 text-white" : "border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-[var(--ink-muted)]">
                  <span>Nada provável</span>
                  <span>Extremamente provável</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {DIMENSOES_CLIMA.map((d) => (
                  <div key={d.key}>
                    <p className="mb-1.5 text-sm font-medium text-[var(--ink)]">{d.label}</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setScores((s) => ({ ...s, [d.key]: n }))}
                          className={
                            "rounded-lg border py-2 text-sm font-semibold transition " +
                            (scores[d.key] === n ? "border-brand-700 bg-brand-700 text-white" : "border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]")
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-[var(--ink-muted)]">
                      <span>Discordo totalmente</span>
                      <span>Concordo totalmente</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium text-[var(--ink)]">Comentário (opcional)</p>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Fique à vontade — ninguém vai saber que foi você."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <Button onClick={handleSubmit} disabled={!podeEnviar || saving}>
              {saving ? "Enviando…" : "Enviar resposta anônima"}
            </Button>
          </div>
        )}

        {!loading && !erro && saved && (
          <div className="py-6 text-center">
            <p className="font-display text-lg font-semibold text-disc-s">Obrigado(a) pela sua resposta!</p>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Sua contribuição é anônima e ajuda a melhorar o ambiente de trabalho para todos.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
