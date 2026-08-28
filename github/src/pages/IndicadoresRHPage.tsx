import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, EmptyState } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/utils";
import {
  ENPS_AMOSTRA_MINIMA_CONFIAVEL,
  calcAbsenteismo,
  calcCustoPorContratacao,
  calcCustoTreinamento,
  calcEnps,
  calcProdutividadeProxy,
  calcTurnover,
  periodoAnoAtual,
  periodoMesAtual,
  periodoTrimestreAtual,
  type Periodo,
} from "@/lib/rhIndicadores";
import type { Colaborador, EventoRH, PesquisaResposta, PesquisaRodada, TreinamentoRH } from "@/types";

type PeriodoOpcao = "mes" | "trimestre" | "ano";

export default function IndicadoresRHPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [eventos, setEventos] = useState<EventoRH[]>([]);
  const [treinamentos, setTreinamentos] = useState<TreinamentoRH[]>([]);
  const [rodadas, setRodadas] = useState<PesquisaRodada[]>([]);
  const [respostasEnps, setRespostasEnps] = useState<PesquisaResposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoOpcao, setPeriodoOpcao] = useState<PeriodoOpcao>("mes");

  useEffect(() => {
    // TODO: filtrar por empresa_id (empresaAtiva do AuthContext) — os
    // indicadores hoje agregam todas as empresas às quais o usuário tem
    // acesso via RLS, não só a empresa selecionada no menu lateral.
    async function load() {
      const [{ data: colabs }, { data: evts }, { data: trein }, { data: rod }] = await Promise.all([
        supabase.from("colaboradores").select("*"),
        supabase.from("eventos_rh").select("*"),
        supabase.from("treinamentos_rh").select("*"),
        supabase.from("pesquisa_rodadas").select("*").eq("tipo", "enps").order("data_abertura", { ascending: false }),
      ]);
      setColaboradores((colabs as Colaborador[]) ?? []);
      setEventos((evts as EventoRH[]) ?? []);
      setTreinamentos((trein as TreinamentoRH[]) ?? []);
      const rodadasEnps = (rod as PesquisaRodada[]) ?? [];
      setRodadas(rodadasEnps);

      const rodadaMaisRecente = rodadasEnps.find((r) => r.ativo) ?? rodadasEnps[0];
      if (rodadaMaisRecente) {
        const { data: respostas } = await supabase.from("pesquisa_respostas").select("*").eq("rodada_id", rodadaMaisRecente.id);
        setRespostasEnps((respostas as PesquisaResposta[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const periodo: Periodo = useMemo(() => {
    if (periodoOpcao === "trimestre") return periodoTrimestreAtual();
    if (periodoOpcao === "ano") return periodoAnoAtual();
    return periodoMesAtual();
  }, [periodoOpcao]);

  const ativosNoPeriodo = colaboradores.filter((c) => {
    const admissao = new Date(c.data_admissao);
    const fim = new Date(periodo.fim);
    if (admissao > fim) return false;
    if (c.data_desligamento && new Date(c.data_desligamento) < new Date(periodo.inicio)) return false;
    return true;
  }).length;

  const absenteismo = calcAbsenteismo(colaboradores, eventos, periodo);
  const turnover = calcTurnover(colaboradores, periodo);
  const custoContratacao = calcCustoPorContratacao(colaboradores, periodo);
  const custoTreinamento = calcCustoTreinamento(treinamentos, ativosNoPeriodo, periodo);
  const enps = calcEnps(respostasEnps);
  const produtividade = calcProdutividadeProxy(colaboradores, eventos, periodo);

  const rodadaEnpsAtual = rodadas.find((r) => r.ativo) ?? rodadas[0];

  if (loading) return <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>;

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Indicadores de RH</h1>
          <p className="text-sm text-[var(--ink-muted)]">Absenteísmo, turnover, custos, eNPS e produtividade — calculados a partir dos eventos registrados.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          {(["mes", "trimestre", "ano"] as PeriodoOpcao[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setPeriodoOpcao(opt)}
              className={
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
                (periodoOpcao === opt ? "bg-brand-700 text-white" : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]")
              }
            >
              {opt === "mes" ? "Este mês" : opt === "trimestre" ? "Este trimestre" : "Este ano"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <IndicadorCard
          label="Absenteísmo"
          resultado={absenteismo}
          formatValor={(v) => `${v.toFixed(1)}%`}
          tone={absenteismo ? (absenteismo.valor > 5 ? "bad" : absenteismo.valor > 2 ? "warn" : "good") : "neutral"}
          caption="(dias perdidos por falta/atestado ÷ dias úteis previstos × colaboradores ativos) × 100, no período selecionado."
        />
        <IndicadorCard
          label="Turnover"
          resultado={turnover}
          formatValor={(v) => `${v.toFixed(1)}%`}
          tone={turnover ? (turnover.valor > 10 ? "bad" : turnover.valor > 5 ? "warn" : "good") : "neutral"}
          caption="Desligamentos no período ÷ média de colaboradores ativos (início e fim do período) × 100."
        />
        <IndicadorCard
          label="Custo por contratação"
          resultado={custoContratacao}
          formatValor={(v) => formatCurrency(v)}
          tone="neutral"
          caption="Média do custo de contratação registrado no cadastro dos colaboradores admitidos no período."
        />
        <IndicadorCard
          label="Custo de treinamento"
          resultado={custoTreinamento}
          formatValor={(v) => formatCurrency(v)}
          tone="neutral"
          caption={
            custoTreinamento?.perCapita != null
              ? `Total no período. Per capita: ${formatCurrency(custoTreinamento.perCapita)} (÷ colaboradores ativos).`
              : "Soma dos custos de treinamentos (individuais + gerais da empresa) registrados no período."
          }
        />
        <IndicadorCard
          label="eNPS"
          resultado={enps}
          formatValor={(v) => v.toFixed(0)}
          tone={enps ? (enps.valor >= 30 ? "good" : enps.valor >= 0 ? "warn" : "bad") : "neutral"}
          caption={
            enps && enps.amostra < ENPS_AMOSTRA_MINIMA_CONFIAVEL
              ? `% promotores − % detratores, rodada "${rodadaEnpsAtual?.rotulo ?? ""}". Amostra baixa (${enps.amostra} resposta(s)) — leia com cautela.`
              : `% promotores (nota 9-10) − % detratores (nota 0-6), rodada "${rodadaEnpsAtual?.rotulo ?? ""}".`
          }
        />
        <IndicadorCard
          label="Produtividade (proxy)"
          resultado={produtividade}
          formatValor={(v) => `${v.toFixed(1)}%`}
          tone={produtividade ? (produtividade.valor >= 95 ? "good" : produtividade.valor >= 90 ? "warn" : "bad") : "neutral"}
          caption="Proxy de presença — não é produtividade de fato: % de dias úteis sem falta/atestado/atraso. Requer KPIs de cargo para medir produtividade real."
        />
      </div>

      <AnaliseCultura
        enps={enps}
        turnover={turnover}
        absenteismo={absenteismo}
        temRodadaClima={rodadas.length > 0 || rodadaEnpsAtual != null}
      />
    </div>
  );
}

function IndicadorCard({
  label,
  resultado,
  formatValor,
  tone,
  caption,
}: {
  label: string;
  resultado: { valor: number; amostra: number } | null;
  formatValor: (v: number) => string;
  tone: "neutral" | "good" | "warn" | "bad";
  caption: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      {resultado ? (
        <>
          <p
            className={
              "mt-2 font-display text-3xl font-semibold " +
              { neutral: "text-[var(--ink)]", good: "text-disc-s", warn: "text-disc-i", bad: "text-disc-d" }[tone]
            }
          >
            {formatValor(resultado.valor)}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{caption}</p>
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-lg font-semibold text-[var(--ink-muted)]">Sem dados suficientes</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{caption}</p>
        </>
      )}
    </Card>
  );
}

// Análise de cultura organizacional: leitura qualitativa simples, por
// faixas (heurística), combinando eNPS + turnover + absenteísmo. Segue o
// mesmo espírito do "clarezaPerfil" do relatório DISC: bandas de leitura,
// não um algoritmo estatístico sofisticado — é um apoio interpretativo,
// não um veredito.
function AnaliseCultura({
  enps,
  turnover,
  absenteismo,
  temRodadaClima,
}: {
  enps: { valor: number; amostra: number } | null;
  turnover: { valor: number; amostra: number } | null;
  absenteismo: { valor: number; amostra: number } | null;
  temRodadaClima: boolean;
}) {
  const sinaisDisponiveis = [enps, turnover, absenteismo].filter(Boolean).length;

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-display text-lg font-semibold">Análise de cultura organizacional</h2>
      {sinaisDisponiveis === 0 ? (
        <EmptyState
          title="Sem dados suficientes"
          description={
            temRodadaClima
              ? "Ainda não há respostas de pesquisa, desligamentos ou eventos suficientes para uma leitura de cultura."
              : "Crie uma rodada de pesquisa de clima/eNPS e registre eventos de RH para habilitar esta análise."
          }
        />
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-[var(--ink-muted)]">
            Leitura heurística com base nos sinais disponíveis ({sinaisDisponiveis} de 3). Quanto mais indicadores tiverem dados, mais confiável a leitura.
          </p>
          <ul className="flex flex-col gap-2">
            {enps && (
              <li>
                <strong>Engajamento (eNPS {enps.valor.toFixed(0)}):</strong>{" "}
                {enps.valor >= 30
                  ? "cultura com forte identificação — colaboradores tendem a recomendar a empresa."
                  : enps.valor >= 0
                  ? "engajamento neutro/misto — há espaço para fortalecer a cultura e a comunicação interna."
                  : "sinal de alerta — mais detratores que promotores, vale investigar causas com a pesquisa de clima."}
              </li>
            )}
            {turnover && (
              <li>
                <strong>Retenção (turnover {turnover.valor.toFixed(1)}%):</strong>{" "}
                {turnover.valor <= 5
                  ? "rotatividade baixa, indício de estabilidade e ambiente saudável."
                  : turnover.valor <= 10
                  ? "rotatividade moderada — acompanhar motivos de desligamento."
                  : "rotatividade alta — pode indicar problemas de cultura, liderança ou remuneração."}
              </li>
            )}
            {absenteismo && (
              <li>
                <strong>Presença (absenteísmo {absenteismo.valor.toFixed(1)}%):</strong>{" "}
                {absenteismo.valor <= 2
                  ? "presença consistente, sem sinais de desengajamento por ausências."
                  : absenteismo.valor <= 5
                  ? "absenteísmo moderado — vale monitorar por setor/gestor."
                  : "absenteísmo elevado — costuma correlacionar com baixo engajamento ou sobrecarga."}
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
