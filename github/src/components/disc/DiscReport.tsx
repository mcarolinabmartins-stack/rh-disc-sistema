import { Printer, Search } from "lucide-react";
import { useState } from "react";
import {
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card, Input, StatCard } from "@/components/ui/primitives";
import { FACTORS, FACTOR_NAME, type DiscLetter } from "@/data/discWords";
import {
  type CargoMercadoDef,
  type ComparacaoCargoMercado,
  compararCargoMercado,
  encontrarCargoMercado,
} from "@/lib/discReportContent";
import type { DiscReportData } from "@/lib/discReportEngine";
import { formatDate } from "@/lib/utils";

const COLOR: Record<DiscLetter, string> = { D: "#C1442A", I: "#C8901A", S: "#3E7D56", C: "#2E5F8A" };
const ROXO = "#5B3A8E";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-4 w-1.5 rounded-full" style={{ background: ROXO }} />
      <h3 className="font-display text-base font-semibold" style={{ color: ROXO }}>
        {children}
      </h3>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 break-inside-avoid">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function Barra100({ valor, cor = ROXO }: { valor: number; cor?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      <div className="h-full rounded-full" style={{ width: `${valor}%`, background: cor }} />
    </div>
  );
}

// Cor de cada um dos 8 segmentos da Roda Comportamental: os 4 arquétipos
// "puros" usam a cor do fator (mesma paleta --disc-d/i/s/c do resto do
// relatório); os 4 mistos usam a cor do fator predominante daquele par, com
// menor opacidade, para diferenciar visualmente puro x misto sem introduzir
// uma paleta nova.
const SEGMENTO_COR: string[] = [COLOR.D, COLOR.D, COLOR.I, COLOR.I, COLOR.S, COLOR.S, COLOR.C, COLOR.C];

function pontoNaRoda(anguloGraus: number, raio: number, cx: number, cy: number) {
  const rad = (anguloGraus * Math.PI) / 180;
  return { x: cx + raio * Math.sin(rad), y: cy - raio * Math.cos(rad) };
}

function RodaComportamental({ roda }: { roda: DiscReportData["analiseAvancada"]["rodaComportamental"] }) {
  const cx = 110;
  const cy = 110;
  const raioExterno = 92;
  const raioInterno = 40;

  const setores = roda.segmentos.map((seg) => {
    const inicio = seg.anguloCentro - 22.5;
    const fim = seg.anguloCentro + 22.5;
    const p1 = pontoNaRoda(inicio, raioExterno, cx, cy);
    const p2 = pontoNaRoda(fim, raioExterno, cx, cy);
    const p3 = pontoNaRoda(fim, raioInterno, cx, cy);
    const p4 = pontoNaRoda(inicio, raioInterno, cx, cy);
    const path = `M ${p1.x} ${p1.y} A ${raioExterno} ${raioExterno} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${raioInterno} ${raioInterno} 0 0 0 ${p4.x} ${p4.y} Z`;
    const ativo = seg.index === roda.segmentoIndex;
    const labelPos = pontoNaRoda(seg.anguloCentro, raioExterno + 16, cx, cy);
    return { ...seg, path, ativo, labelPos };
  });

  const ponteiro = pontoNaRoda(roda.anguloGraus, raioInterno - 4, cx, cy);
  const ponteiroExterno = pontoNaRoda(roda.anguloGraus, raioExterno + 4, cx, cy);

  return (
    <svg viewBox="0 0 220 250" className="mx-auto h-auto w-full max-w-xs">
      {setores.map((s) => (
        <path
          key={s.index}
          d={s.path}
          fill={SEGMENTO_COR[s.index]}
          fillOpacity={s.ativo ? 0.9 : 0.18}
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      ))}
      <line x1={ponteiro.x} y1={ponteiro.y} x2={ponteiroExterno.x} y2={ponteiroExterno.y} stroke={ROXO} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={ROXO} />
      {setores.map((s) => (
        <text
          key={`label-${s.index}`}
          x={s.labelPos.x}
          y={s.labelPos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fontWeight={s.ativo ? 700 : 500}
          fill={s.ativo ? ROXO : "var(--ink-muted)"}
        >
          {s.index % 2 === 0 ? ARCHETYPE_LETTER_LABEL[s.index] : ""}
        </text>
      ))}
    </svg>
  );
}

// Rótulo curto (só nos 4 puros, para não poluir a roda) usando as letras
// técnicas D/I/S/C como abreviação — igual ao restante do relatório, que já
// usa D/I/S/C como abreviação nos eixos de gráfico mesmo priorizando os
// nomes de arquétipo no texto.
const ARCHETYPE_LETTER_LABEL: Record<number, string> = { 0: "D", 2: "I", 4: "S", 6: "C" };

export function DiscReport({ data }: { data: DiscReportData }) {
  const primeiroNome = data.nome.split(" ")[0];
  const [cargoInput, setCargoInput] = useState("");
  const [cargoBusca, setCargoBusca] = useState<{ cargo: CargoMercadoDef; resultado: ComparacaoCargoMercado } | "nao-encontrado" | null>(null);

  function buscarCargoMercado() {
    const achado = encontrarCargoMercado(cargoInput);
    if (!achado) {
      setCargoBusca("nao-encontrado");
      return;
    }
    setCargoBusca({ cargo: achado, resultado: compararCargoMercado(data.norm, achado) });
  }
  const linhaPercepcao = FACTORS.map((f) => ({
    fator: FACTOR_NAME[f],
    lideranca: { D: "Dominante", I: "Informal", S: "Condescendente", C: "Formal" }[f],
    "Perfil Atual": data.norm[f],
    "Como você se vê": data.selfPct[f],
    "Como os outros veem": data.othersPct[f],
  }));

  // Maior divergência real entre autopercepção e percepção alheia, entre os
  // 4 fatores desta avaliação — usado para personalizar a legenda do gráfico
  // com o dado mais relevante desta pessoa, em vez de um texto instrutivo
  // genérico igual para todo mundo.
  const maiorGap = data.comparacaoPercepcao.reduce((max, f) => (Math.abs(f.delta) > Math.abs(max.delta) ? f : max), data.comparacaoPercepcao[0]);
  const fatorPrimario = data.perfilPercentual[0];
  const lideracaLabel: Record<DiscLetter, string> = { D: "Dominante", I: "Informal", S: "Condescendente", C: "Formal" };

  const radarCompetencias = data.competencias.map((c) => ({ nome: c.nome, valor: c.valor }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir / salvar em PDF
        </Button>
      </div>

      {/* Capa */}
      <Card className="mb-8 overflow-hidden p-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: ROXO }}>
          Relatório Comportamental · Estendido
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold">{data.nome}</h1>
        {data.dataAplicacao && <p className="mt-2 text-sm text-[var(--ink-muted)]">Avaliação realizada em {formatDate(data.dataAplicacao)}</p>}
        <div className="mx-auto mt-6 max-w-sm rounded-xl bg-[var(--surface-sunken)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Neste momento, {data.nome.split(" ")[0]} está:</p>
          <p className="mt-1 font-display text-2xl font-bold" style={{ color: ROXO }}>
            {data.nomePerfil}
          </p>
        </div>
      </Card>

      {/* Perfil DISC */}
      <Section title="Perfil DISC">
        <div className="mb-4 flex h-6 overflow-hidden rounded-full">
          {data.perfilPercentual.map((p) => (
            <div key={p.fator} style={{ width: `${p.pct}%`, background: COLOR[p.fator] }} title={`${p.nome} ${p.pct}%`} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {data.perfilPercentual.map((p) => (
            <div key={p.fator}>
              <p className="font-display text-lg font-bold" style={{ color: COLOR[p.fator] }}>
                {p.pct.toFixed(2)}%
              </p>
              <p className="text-xs font-semibold">{p.nome}</p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">{p.nivel}</p>
            </div>
          ))}
        </div>
        {data.cargoTitulo && data.compatibilidadeCargo != null && (
          <div className="mt-4 rounded-xl bg-[var(--surface-sunken)] p-3 text-center text-sm">
            Aderência ao perfil ideal do cargo <b>{data.cargoTitulo}</b>: <span className="font-mono font-semibold">{data.compatibilidadeCargo}%</span>
          </div>
        )}
        {data.confiabilidadeResposta && (
          <div className="mt-4 rounded-xl bg-[var(--surface-sunken)] p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Confiabilidade da coleta (tempo de resposta)</p>
              <span className="font-mono text-xs font-semibold">{data.confiabilidadeResposta.pctSaudavel}%</span>
            </div>
            <Barra100 valor={data.confiabilidadeResposta.pctSaudavel} />
            <p className="mt-2 text-xs text-[var(--ink-muted)]">{data.confiabilidadeResposta.leitura}</p>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Tempo médio por resposta: {data.confiabilidadeResposta.tempoMedioSeg}s · {data.confiabilidadeResposta.rapidas} rápida(s) demais ·{" "}
              {data.confiabilidadeResposta.lentas} lenta(s) demais, de {data.confiabilidadeResposta.totalRespostas} respostas registradas.
            </p>
            <p className="mt-1 text-[11px] italic text-[var(--ink-muted)]">
              Isso não altera os escores D/I/S/C — a literatura DISC não valida um limiar de tempo para recalcular perfil. É um indicador de
              qualidade da coleta, emprestado da metodologia geral de pesquisa por questionário, para sinalizar quando vale ler o resultado com
              mais cautela.
            </p>
          </div>
        )}
      </Section>

      <Section title="Comparação com o cargo (mercado)">
        <p className="mb-3 text-sm text-[var(--ink-muted)]">
          Digite um cargo (atual ou pretendido) para comparar o perfil de {primeiroNome} com o que o mercado costuma exigir para essa função.
          Isso é uma referência curada com base em práticas gerais de recrutamento comportamental — não é um levantamento estatístico do
          mercado em tempo real, e vale como ponto de partida para a devolutiva, não como veredito definitivo.
        </p>
        <div className="flex gap-2 print:hidden">
          <Input
            placeholder="Ex.: Analista Financeiro, Vendedor, Gerente…"
            value={cargoInput}
            onChange={(e) => setCargoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscarCargoMercado()}
            className="flex-1"
          />
          <Button variant="ghost" onClick={buscarCargoMercado}>
            <Search size={16} /> Comparar
          </Button>
        </div>

        {cargoBusca === "nao-encontrado" && (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Ainda não temos uma referência de mercado cadastrada para esse cargo. Tente um termo mais genérico (ex.: "vendas" em vez do nome
            exato do cargo interno), ou veja o ranking de arquétipos em "Área de talentos" abaixo como aproximação.
          </p>
        )}

        {cargoBusca && cargoBusca !== "nao-encontrado" && (
          <div className="mt-4 rounded-xl bg-[var(--surface-sunken)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{cargoBusca.cargo.nome}</p>
              <span className="font-mono text-sm font-semibold">{cargoBusca.resultado.aderencia}%</span>
            </div>
            <Barra100 valor={cargoBusca.resultado.aderencia} />
            <p className="mt-2 text-sm font-semibold" style={{ color: ROXO }}>
              {cargoBusca.resultado.veredito}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              O mercado costuma esperar, para esse tipo de função: {cargoBusca.cargo.exigencias}
            </p>
            {cargoBusca.resultado.fatoresDivergentes.length > 0 && (
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                Maior distância em: <b>{cargoBusca.resultado.fatoresDivergentes.map((f) => FACTOR_NAME[f]).join(", ")}</b> — vale explorar isso na
                devolutiva, seja como ponto de desenvolvimento, seja como ajuste de expectativa sobre a rotina do cargo.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="Sub-características">
        <p className="text-sm text-[var(--ink-muted)]">
          As sub-características deste tipo são: <b>{data.texto.subCaracteristicas.join(", ")}.</b>
        </p>
      </Section>

      <Section title="Habilidades básicas">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.habilidadesBasicas}</p>
      </Section>

      <Section title="Habilidades comuns">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.habilidadesComuns}</p>
      </Section>

      <Section title="Como você se vê x como os outros te veem">
        <p className="mb-4 text-sm text-[var(--ink-muted)]">
          Comparação direta entre as duas rodadas do questionário. Um número positivo indica que as pessoas ao redor percebem mais esse
          traço em {data.nome.split(" ")[0]} do que ela mesma percebe; um número negativo indica o contrário.
        </p>
        <div className="grid grid-cols-4 gap-3 text-center">
          {data.comparacaoPercepcao.map((f) => (
            <div key={f.fator}>
              <p className="text-xs font-semibold" style={{ color: COLOR[f.fator] }}>
                {f.comoSeVe}% / {f.comoOsOutrosVeem}%
              </p>
              <div className="mt-1 h-2 rounded-full" style={{ background: COLOR[f.fator], opacity: 0.85 }} />
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{f.nome}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[var(--ink-muted)]">
                {f.delta > 0 ? "+" : ""}
                {f.delta}%
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Vantagens">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.vantagens}</p>
      </Section>
      <Section title="Desvantagens">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.desvantagens}</p>
      </Section>

      <Section title="Indicadores situacionais">
        <div className="flex flex-col gap-4">
          {data.indicadoresSituacionais.map((i) => (
            <div key={i.nome}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">{i.nome}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{i.nivel}</span>
              </div>
              <Barra100 valor={i.valor} />
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{i.descricao}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] italic text-[var(--ink-muted)]">
          Indicadores estimados a partir do próprio perfil DISC desta avaliação, calculados pelo sistema — não são índices clínicos.
        </p>
      </Section>

      <Section title="Perfil atual x natural x percebido">
        <p className="mb-3 text-sm text-[var(--ink-muted)]">
          Compara o perfil atual (média das duas rodadas) com "como você se vê" (rodada 1) e "como os outros te veem" (rodada 2) — dados reais
          das respostas, sem estimativa. Em {primeiroNome}, a maior divergência está em {maiorGap.nome}:{" "}
          {maiorGap.delta > 0
            ? `as pessoas ao redor percebem esse traço ${Math.abs(maiorGap.delta)} pontos acima do que ${primeiroNome} percebe em si mesma (${maiorGap.comoSeVe}% x ${maiorGap.comoOsOutrosVeem}%).`
            : maiorGap.delta < 0
            ? `${primeiroNome} se percebe ${Math.abs(maiorGap.delta)} pontos acima do que o ambiente percebe nesse traço (${maiorGap.comoSeVe}% x ${maiorGap.comoOsOutrosVeem}%).`
            : `nesse traço a autopercepção e a percepção do ambiente coincidem quase exatamente (${maiorGap.comoSeVe}% x ${maiorGap.comoOsOutrosVeem}%).`}
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={linhaPercepcao} margin={{ left: -20 }}>
              <XAxis dataKey="fator" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Perfil Atual" stroke={ROXO} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Como você se vê" stroke="#3E7D56" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Como os outros veem" stroke="#C1442A" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Estilo de liderança (gráfico)">
        <p className="mb-3 text-sm text-[var(--ink-muted)]">
          Os mesmos eixos comportamentais, sob a ótica de estilo de liderança: Dominante, Informal, Condescendente e Formal. No perfil atual de{" "}
          {primeiroNome}, o traço que mais se destaca é {lideracaLabel[fatorPrimario.fator]} ({fatorPrimario.nome}, {fatorPrimario.pct.toFixed(0)}%),
          o que tende a definir o estilo de liderança predominante de {primeiroNome} na prática.
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={linhaPercepcao} margin={{ left: -20 }}>
              <XAxis dataKey="lideranca" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Perfil Atual" stroke={ROXO} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Como você se vê" stroke="#3E7D56" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Como os outros veem" stroke="#C1442A" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Estilo de gestão requerido">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.estiloGestaoRequerido}</p>
      </Section>
      <Section title="Estilo de liderança">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.estiloLideranca}</p>
      </Section>
      <Section title="Estilo de comunicação">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.estiloComunicacao}</p>
      </Section>
      <Section title="Ambiente de trabalho">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.ambienteTrabalho}</p>
      </Section>
      <Section title="Desempenho de tarefas">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.desempenhoTarefas}</p>
      </Section>
      <Section title="Estilo de vendas">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.estiloVendas}</p>
      </Section>
      <Section title="Fatores motivacionais">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.fatoresMotivacionais}</p>
      </Section>

      <div className="mb-7 grid grid-cols-3 gap-4 break-inside-avoid">
        <div>
          <SectionTitle>Valoriza os outros por…</SectionTitle>
          <p className="text-sm text-[var(--ink-muted)]">{data.texto.valorizaOutrosPor.join(", ")}.</p>
        </div>
        <div>
          <SectionTitle>Necessidades básicas</SectionTitle>
          <p className="text-sm text-[var(--ink-muted)]">{data.texto.necessidadesBasicas.join(", ")}.</p>
        </div>
        <div>
          <SectionTitle>Fatores de afastamento</SectionTitle>
          <p className="text-sm text-[var(--ink-muted)]">{data.texto.fatoresAfastamento.join(", ")}.</p>
        </div>
      </div>

      <Section title="Forma como busca resultados">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.formaBuscaResultados}</p>
      </Section>
      <Section title="Organização e planejamento">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.organizacaoPlanejamento}</p>
      </Section>
      <Section title="Reação sob pressão">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.reacaoPressao}</p>
      </Section>
      <Section title="Relação com mudanças">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.relacaoMudancas}</p>
      </Section>
      <Section title="Relacionamentos">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.relacionamentos}</p>
      </Section>
      <Section title="Relacionando-se com os outros">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.relacionandoOutros}</p>
      </Section>
      <Section title="Tomando decisões">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.texto.tomandoDecisoes}</p>
      </Section>

      <Section title="Gráfico de competências">
        <div style={{ width: "100%", height: 340 }} className="print:hidden">
          <ResponsiveContainer>
            <RadarChart data={radarCompetencias} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="nome" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar dataKey="valor" stroke={ROXO} fill={ROXO} fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {data.competencias.map((c) => (
            <div key={c.nome}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">{c.nome}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{c.nivel}</span>
              </div>
              <Barra100 valor={c.valor} />
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{c.descricao}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Área de talentos">
        <p className="mb-4 text-sm text-[var(--ink-muted)]">
          Ranking de aderência de {data.nome.split(" ")[0]} aos 13 arquétipos profissionais, do mais para o menos aderente.
        </p>
        <div className="flex flex-col gap-3">
          {data.areaTalentos.map((t, idx) => (
            <div key={t.nome}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {idx + 1}. {t.nome}
                </p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{t.nivel}</span>
              </div>
              <Barra100 valor={t.valor} />
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{t.descricao}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Análise Comportamental Detalhada">
        <p className="mb-5 text-[11px] italic text-[var(--ink-muted)]">
          Esta seção complementa o relatório acima com uma leitura mais aprofundada, gerada por regras a partir dos dados reais desta
          avaliação (mesmo método de geração de texto das seções anteriores) — não é uma análise feita por inteligência artificial nem uma
          medição psicométrica validada, e deve ser lida como apoio qualitativo para a devolutiva.
        </p>

        <div className="mb-6">
          <SectionTitle>Sumário executivo</SectionTitle>
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.analiseAvancada.sumarioExecutivo}</p>
        </div>

        <div className="mb-6">
          <SectionTitle>Retrato comportamental</SectionTitle>
          <div className="flex flex-col gap-3">
            {data.analiseAvancada.retratoComportamental.map((par, i) => (
              <p key={i} className="text-sm leading-relaxed text-[var(--ink-muted)]">
                {par}
              </p>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <SectionTitle>Ambiente ideal</SectionTitle>
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">{data.analiseAvancada.ambienteIdeal}</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <SectionTitle>Forças</SectionTitle>
            <ul className="flex flex-col gap-2">
              {data.analiseAvancada.forcas.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--ink-muted)]">
                  <span style={{ color: ROXO }}>•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <SectionTitle>Pontos de atenção</SectionTitle>
            <ul className="flex flex-col gap-2">
              {data.analiseAvancada.pontosAtencao.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--ink-muted)]">
                  <span style={{ color: ROXO }}>•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mb-6">
          <SectionTitle>Roda comportamental</SectionTitle>
          <p className="mb-3 text-sm text-[var(--ink-muted)]">
            Posição de {primeiroNome} na roda dos 8 octantes comportamentais (4 arquétipos "puros" + 4 combinações entre arquétipos
            vizinhos). Octante atual: <b>{data.analiseAvancada.rodaComportamental.octanteAtual}</b>.
          </p>
          <RodaComportamental roda={data.analiseAvancada.rodaComportamental} />
          <p className="mt-2 text-center text-[11px] italic text-[var(--ink-muted)]">
            Visualização própria deste sistema, derivada do perfil D/I/S/C atual — não é uma ferramenta clínica validada.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <StatCard
              label="Índice de pressão"
              value={`${data.analiseAvancada.indicePressao.valor} · ${data.analiseAvancada.indicePressao.leitura}`}
              sub="Combina os fatores Executor e Analista (tarefa/questionador) — quanto maior, mais a pessoa tende a se autocobrar e a projetar cobrança no ambiente."
            />
          </div>
          <div>
            <StatCard
              label="Índice de adaptação"
              value={`${data.analiseAvancada.indiceAdaptacao.valor} · ${data.analiseAvancada.indiceAdaptacao.leitura}`}
              sub="Mede a distância entre como a pessoa se vê e como é percebida — quanto maior, mais o comportamento parece se ajustar ao ambiente."
            />
          </div>
        </div>
        <p className="mb-6 text-[11px] italic text-[var(--ink-muted)]">
          Os dois índices acima são heurísticas próprias deste sistema, adaptadas de um material de referência — não são índices
          psicométricos validados publicamente. Assim como a confiabilidade da coleta (na Capa), servem como sinal de apoio, não como
          medição precisa.
        </p>

        <div>
          <SectionTitle>Perguntas sugeridas para entrevista</SectionTitle>
          <ol className="flex flex-col gap-2">
            {data.analiseAvancada.perguntasEntrevista.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                <span className="font-semibold" style={{ color: ROXO }}>
                  {i + 1}.
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <p className="mt-10 text-center text-[11px] text-[var(--ink-muted)]">
        Relatório gerado automaticamente a partir da autoavaliação DISC de {data.nome}
        {data.dataAplicacao ? ` em ${formatDate(data.dataAplicacao)}` : ""}. Uso interno de RH.
      </p>
    </div>
  );
}
