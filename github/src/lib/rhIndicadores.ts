// =========================================================================
// Indicadores de RH — fórmulas
//
// Carolina (RH) não definiu fórmulas específicas da empresa para os 6
// indicadores pedidos, então este arquivo usa fórmulas PADRÃO / de mercado,
// amplamente aceitas em gestão de pessoas, documentadas uma a uma abaixo.
// Cada função:
//   - recebe os registros brutos do período (colaboradores/eventos/etc.)
//   - retorna `{ valor, amostra } | null`
//   - retorna `null` quando não há dados mínimos para um cálculo confiável,
//     para que a UI mostre "Sem dados suficientes" em vez de um número
//     enganoso (ex.: 0% de turnover porque não há nenhum colaborador
//     cadastrado ainda, o que não é o mesmo que "turnover zero").
// =========================================================================

import type { Colaborador, EventoRH, PesquisaResposta, TreinamentoRH } from "@/types";

export interface IndicadorResultado {
  valor: number; // já em % quando aplicável
  amostra: number; // tamanho da amostra usada — para a UI decidir se exibe caveat de baixa confiança
}

export interface Periodo {
  inicio: string; // 'YYYY-MM-DD'
  fim: string; // 'YYYY-MM-DD'
}

function toDate(s: string) {
  return new Date(s + (s.length === 10 ? "T00:00:00" : ""));
}

// Conta dias úteis (segunda a sexta) entre duas datas, inclusive.
// Aproximação padrão de mercado — não desconta feriados nacionais/locais,
// pois o sistema não tem um calendário de feriados cadastrado.
function diasUteisEntre(inicio: string, fim: string): number {
  const start = toDate(inicio);
  const end = toDate(fim);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Sobrepõe um intervalo [a_inicio, a_fim] ao período de análise, retornando
// o intervalo de interseção (ou null se não houver sobreposição).
function intersecaoPeriodo(evInicio: string, evFim: string | null, periodo: Periodo): [string, string] | null {
  const a = toDate(evInicio);
  const b = evFim ? toDate(evFim) : a;
  const p1 = toDate(periodo.inicio);
  const p2 = toDate(periodo.fim);
  const start = a > p1 ? a : p1;
  const end = b < p2 ? b : p2;
  if (start > end) return null;
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

// Um colaborador é considerado "ativo no período" se sua admissão começou
// antes (ou durante) o fim do período e ele não foi desligado antes do
// início do período.
function estevaAtivoNoPeriodo(c: Colaborador, periodo: Periodo): boolean {
  const admissao = toDate(c.data_admissao);
  const p2 = toDate(periodo.fim);
  if (admissao > p2) return false;
  if (c.data_desligamento) {
    const deslig = toDate(c.data_desligamento);
    const p1 = toDate(periodo.inicio);
    if (deslig < p1) return false;
  }
  return true;
}

// -------------------------------------------------------------------------
// 1) ABSENTEÍSMO (%)
//
// Fórmula padrão:
//   Absenteísmo = (dias perdidos por falta/atestado no período, somados
//                  para todos os colaboradores ativos)
//                 / (dias úteis totais previstos no período × nº de
//                    colaboradores ativos)  × 100
//
// "Dias perdidos" considera eventos do tipo 'falta' e 'atestado' (campo
// `dias`, ou a diferença data_fim - data_inicio quando `dias` não foi
// informado), recortados pela interseção com o período analisado.
//
// Requisito mínimo: pelo menos 1 colaborador ativo no período E o período
// ter pelo menos 1 dia útil. Sem isso, retorna null.
// -------------------------------------------------------------------------
export function calcAbsenteismo(colaboradores: Colaborador[], eventos: EventoRH[], periodo: Periodo): IndicadorResultado | null {
  const ativos = colaboradores.filter((c) => estevaAtivoNoPeriodo(c, periodo));
  const diasUteisPeriodo = diasUteisEntre(periodo.inicio, periodo.fim);
  if (ativos.length === 0 || diasUteisPeriodo === 0) return null;

  const idsAtivos = new Set(ativos.map((c) => c.id));
  let diasPerdidos = 0;
  for (const ev of eventos) {
    if (ev.tipo !== "falta" && ev.tipo !== "atestado") continue;
    if (!idsAtivos.has(ev.colaborador_id)) continue;
    const inter = intersecaoPeriodo(ev.data_inicio, ev.data_fim, periodo);
    if (!inter) continue;
    if (ev.dias != null) {
      diasPerdidos += ev.dias;
    } else {
      diasPerdidos += diasUteisEntre(inter[0], inter[1]);
    }
  }

  const diasPrevistoTotal = diasUteisPeriodo * ativos.length;
  const valor = (diasPerdidos / diasPrevistoTotal) * 100;
  return { valor: round2(valor), amostra: ativos.length };
}

// -------------------------------------------------------------------------
// 2) TURNOVER (%)
//
// Fórmula padrão mensal/anual:
//   Turnover = (nº de desligamentos no período) / (média de colaboradores
//              ativos no período) × 100
//
// A "média de colaboradores ativos" usa a média simples entre o headcount
// no início e no fim do período: (ativos no início + ativos no fim) / 2.
// Essa é a variante mais comum (inclui o efeito de admissões no período
// no denominador, em vez de fixar apenas o headcount inicial).
//
// Requisito mínimo: headcount médio > 0.
// -------------------------------------------------------------------------
export function calcTurnover(colaboradores: Colaborador[], periodo: Periodo): IndicadorResultado | null {
  const p1 = toDate(periodo.inicio);
  const p2 = toDate(periodo.fim);

  const ativosNoInicio = colaboradores.filter((c) => {
    const admissao = toDate(c.data_admissao);
    if (admissao > p1) return false;
    if (c.data_desligamento && toDate(c.data_desligamento) < p1) return false;
    return true;
  }).length;

  const ativosNoFim = colaboradores.filter((c) => {
    const admissao = toDate(c.data_admissao);
    if (admissao > p2) return false;
    if (c.data_desligamento && toDate(c.data_desligamento) < p2) return false;
    return true;
  }).length;

  const desligamentosNoPeriodo = colaboradores.filter((c) => {
    if (!c.data_desligamento) return false;
    const d = toDate(c.data_desligamento);
    return d >= p1 && d <= p2;
  }).length;

  const mediaAtivos = (ativosNoInicio + ativosNoFim) / 2;
  if (mediaAtivos <= 0) return null;

  const valor = (desligamentosNoPeriodo / mediaAtivos) * 100;
  return { valor: round2(valor), amostra: Math.round(mediaAtivos) };
}

// -------------------------------------------------------------------------
// 3) CUSTO POR CONTRATAÇÃO
//
// Fórmula padrão:
//   Custo por contratação = soma(custo_contratacao dos admitidos no
//                            período) / (nº de admissões no período)
//
// Usa o campo `custo_contratacao` registrado no cadastro do colaborador no
// momento da admissão (recrutamento, seleção, etc.). Admissões sem esse
// custo preenchido são ignoradas no cálculo (não entram no numerador nem
// no denominador), para não distorcer a média para baixo.
//
// Requisito mínimo: pelo menos 1 admissão no período com custo_contratacao
// preenchido.
// -------------------------------------------------------------------------
export function calcCustoPorContratacao(colaboradores: Colaborador[], periodo: Periodo): IndicadorResultado | null {
  const p1 = toDate(periodo.inicio);
  const p2 = toDate(periodo.fim);

  const admitidosComCusto = colaboradores.filter((c) => {
    const admissao = toDate(c.data_admissao);
    return admissao >= p1 && admissao <= p2 && c.custo_contratacao != null;
  });

  if (admitidosComCusto.length === 0) return null;

  const soma = admitidosComCusto.reduce((sum, c) => sum + Number(c.custo_contratacao ?? 0), 0);
  return { valor: round2(soma / admitidosComCusto.length), amostra: admitidosComCusto.length };
}

// -------------------------------------------------------------------------
// 4) CUSTO DE TREINAMENTO
//
// Fórmula padrão:
//   Custo de treinamento (total) = soma(treinamentos_rh.custo) no período
//   Custo per capita = total / nº de colaboradores ativos no período
//
// Considera tanto treinamentos individuais quanto gerais da empresa
// (colaborador_id nulo).
//
// Requisito mínimo: pelo menos 1 registro de treinamento no período.
// -------------------------------------------------------------------------
export function calcCustoTreinamento(
  treinamentos: TreinamentoRH[],
  colaboradoresAtivosNoPeriodo: number,
  periodo: Periodo
): (IndicadorResultado & { perCapita: number | null }) | null {
  const p1 = toDate(periodo.inicio);
  const p2 = toDate(periodo.fim);
  const doPeriodo = treinamentos.filter((t) => {
    const d = toDate(t.data);
    return d >= p1 && d <= p2;
  });
  if (doPeriodo.length === 0) return null;

  const total = doPeriodo.reduce((sum, t) => sum + Number(t.custo || 0), 0);
  const perCapita = colaboradoresAtivosNoPeriodo > 0 ? round2(total / colaboradoresAtivosNoPeriodo) : null;
  return { valor: round2(total), amostra: doPeriodo.length, perCapita };
}

// -------------------------------------------------------------------------
// 5) eNPS (Employee Net Promoter Score)
//
// Fórmula padrão:
//   eNPS = % promotores (nota 9-10) − % detratores (nota 0-6)
//   (notas 7-8 são "neutros", contam na base mas não no numerador)
//
// Usa as respostas da rodada do tipo 'enps' mais recente (ativa, ou já
// fechada se não houver nenhuma ativa).
//
// Requisito mínimo: pelo menos 1 resposta. Abaixo de ~5 respostas o
// resultado é estatisticamente pouco confiável — a função ainda calcula
// e retorna o valor, mas sinaliza isso via `amostra` para a UI exibir um
// aviso de "amostra baixa" (não escondemos o número, só o contextualizamos).
// -------------------------------------------------------------------------
export const ENPS_AMOSTRA_MINIMA_CONFIAVEL = 5;

export function calcEnps(respostas: PesquisaResposta[]): IndicadorResultado | null {
  const notas = respostas.map((r) => r.respostas?.nota).filter((n): n is number => typeof n === "number");
  if (notas.length === 0) return null;

  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const valor = ((promotores - detratores) / notas.length) * 100;
  return { valor: round2(valor), amostra: notas.length };
}

// -------------------------------------------------------------------------
// 6) PRODUTIVIDADE (proxy de presença)
//
// ATENÇÃO — LIMITAÇÃO IMPORTANTE:
// Este NÃO é um indicador de produtividade real (que exigiria metas/KPIs
// específicos de cada cargo/função, não capturados por um sistema
// genérico de RH). É uma PROXY baseada em presença: o inverso do
// absenteísmo, isto é, o percentual de dias úteis previstos em que os
// colaboradores efetivamente estiveram disponíveis para o trabalho
// (não descontados por falta, atestado ou atraso convertido em dias).
//
// Fórmula:
//   Produtividade (proxy) = (dias úteis previstos − dias perdidos por
//   falta/atestado/atraso) / dias úteis previstos × 100
//
// Atrasos (`horas`) são convertidos em fração de dia usando uma jornada
// padrão de 8h/dia (aproximação — o sistema não guarda a carga horária
// contratual de cada colaborador).
//
// Requisito mínimo: mesmo de absenteísmo — pelo menos 1 colaborador ativo
// e período com pelo menos 1 dia útil.
// -------------------------------------------------------------------------
const JORNADA_PADRAO_HORAS = 8;

export function calcProdutividadeProxy(colaboradores: Colaborador[], eventos: EventoRH[], periodo: Periodo): IndicadorResultado | null {
  const ativos = colaboradores.filter((c) => estevaAtivoNoPeriodo(c, periodo));
  const diasUteisPeriodo = diasUteisEntre(periodo.inicio, periodo.fim);
  if (ativos.length === 0 || diasUteisPeriodo === 0) return null;

  const idsAtivos = new Set(ativos.map((c) => c.id));
  let diasPerdidos = 0;
  for (const ev of eventos) {
    if (!idsAtivos.has(ev.colaborador_id)) continue;
    const inter = intersecaoPeriodo(ev.data_inicio, ev.data_fim, periodo);
    if (!inter) continue;

    if (ev.tipo === "falta" || ev.tipo === "atestado") {
      diasPerdidos += ev.dias != null ? ev.dias : diasUteisEntre(inter[0], inter[1]);
    } else if (ev.tipo === "atraso" && ev.horas != null) {
      diasPerdidos += ev.horas / JORNADA_PADRAO_HORAS;
    }
  }

  const diasPrevistoTotal = diasUteisPeriodo * ativos.length;
  const valor = ((diasPrevistoTotal - diasPerdidos) / diasPrevistoTotal) * 100;
  return { valor: round2(Math.max(0, valor)), amostra: ativos.length };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// -------------------------------------------------------------------------
// Períodos pré-definidos para o seletor da UI
// -------------------------------------------------------------------------
export function periodoMesAtual(ref: Date = new Date()): Periodo {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function periodoTrimestreAtual(ref: Date = new Date()): Periodo {
  const trimestre = Math.floor(ref.getMonth() / 3);
  const inicio = new Date(ref.getFullYear(), trimestre * 3, 1);
  const fim = new Date(ref.getFullYear(), trimestre * 3 + 3, 0);
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function periodoAnoAtual(ref: Date = new Date()): Periodo {
  return { inicio: iso(new Date(ref.getFullYear(), 0, 1)), fim: iso(new Date(ref.getFullYear(), 11, 31)) };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
