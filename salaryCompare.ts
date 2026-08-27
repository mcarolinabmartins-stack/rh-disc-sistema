import type { BenchmarkMercado, Colaborador, FaixaSalarial } from "@/types";

export type FaixaStatus = "abaixo" | "dentro" | "acima" | "sem_dado";

export interface FaixaComparison {
  status: FaixaStatus;
  faixa: FaixaSalarial | null;
  diffPct: number | null; // diferença % em relação ao salário médio da faixa
}

export interface BenchmarkComparison {
  status: FaixaStatus;
  benchmark: BenchmarkMercado | null;
  matchLevel: "cargo_estado_ramo_regime" | "cargo_estado_regime" | "cargo_regime" | "cargo" | "nenhum";
  diffPct: number | null;
}

/** Encontra a faixa salarial interna vigente mais recente para o cargo do colaborador. */
export function findFaixaVigente(faixas: FaixaSalarial[], cargoId: string | null): FaixaSalarial | null {
  if (!cargoId) return null;
  const doCargo = faixas.filter((f) => f.cargo_id === cargoId);
  if (doCargo.length === 0) return null;
  return doCargo.sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1))[0];
}

export function compareToFaixaInterna(colaborador: Colaborador, faixas: FaixaSalarial[]): FaixaComparison {
  const faixa = findFaixaVigente(faixas, colaborador.cargo_id);
  if (!faixa) return { status: "sem_dado", faixa: null, diffPct: null };
  const { salario_atual } = colaborador;
  const diffPct = Math.round(((salario_atual - faixa.salario_medio) / faixa.salario_medio) * 1000) / 10;
  let status: FaixaStatus = "dentro";
  if (salario_atual < faixa.salario_min) status = "abaixo";
  else if (salario_atual > faixa.salario_max) status = "acima";
  return { status, faixa, diffPct };
}

/**
 * Compara o salário do colaborador com o mercado, buscando o benchmark mais específico
 * disponível, nesta ordem: cargo + estado + ramo de atuação + regime de contratação (CLT/PJ)
 * > cargo + estado + regime > cargo + regime (média entre ramos/estados) > cargo (média geral).
 * O regime de contratação é sempre respeitado quando há dado disponível, pois faixas de
 * mercado para PJ e CLT normalmente não são comparáveis diretamente.
 */
export function compareToMercado(
  colaborador: Colaborador,
  benchmarks: BenchmarkMercado[],
  ramoAtuacaoEmpresa: string
): BenchmarkComparison {
  if (!colaborador.cargo_id) return { status: "sem_dado", benchmark: null, matchLevel: "nenhum", diffPct: null };

  const doCargo = benchmarks.filter((b) => b.cargo_id === colaborador.cargo_id);
  if (doCargo.length === 0) return { status: "sem_dado", benchmark: null, matchLevel: "nenhum", diffPct: null };

  const doCargoMesmoRegime = doCargo.filter((b) => b.regime_contratacao === colaborador.regime_contratacao);
  const pool = doCargoMesmoRegime.length > 0 ? doCargoMesmoRegime : doCargo;

  const exact = pool.find(
    (b) => b.estado === colaborador.estado && b.ramo_atuacao.toLowerCase() === ramoAtuacaoEmpresa.toLowerCase()
  );
  const porEstado = pool.filter((b) => b.estado === colaborador.estado);

  let benchmark: BenchmarkMercado | null = null;
  let matchLevel: BenchmarkComparison["matchLevel"] = "nenhum";

  if (exact) {
    benchmark = exact;
    matchLevel = "cargo_estado_ramo_regime";
  } else if (porEstado.length > 0) {
    // média simples entre os ramos disponíveis nesse estado, mesmo regime de contratação
    benchmark = averageBenchmark(porEstado);
    matchLevel = "cargo_estado_regime";
  } else if (doCargoMesmoRegime.length > 0) {
    benchmark = averageBenchmark(doCargoMesmoRegime);
    matchLevel = "cargo_regime";
  } else {
    benchmark = averageBenchmark(doCargo);
    matchLevel = "cargo";
  }

  if (!benchmark) return { status: "sem_dado", benchmark: null, matchLevel: "nenhum", diffPct: null };

  const { salario_atual } = colaborador;
  const diffPct = Math.round(((salario_atual - benchmark.salario_medio) / benchmark.salario_medio) * 1000) / 10;
  let status: FaixaStatus = "dentro";
  if (salario_atual < benchmark.salario_min) status = "abaixo";
  else if (salario_atual > benchmark.salario_max) status = "acima";

  return { status, benchmark, matchLevel, diffPct };
}

function averageBenchmark(list: BenchmarkMercado[]): BenchmarkMercado {
  const n = list.length;
  const sum = list.reduce(
    (acc, b) => {
      acc.min += Number(b.salario_min);
      acc.medio += Number(b.salario_medio);
      acc.max += Number(b.salario_max);
      return acc;
    },
    { min: 0, medio: 0, max: 0 }
  );
  return {
    ...list[0],
    salario_min: Math.round(sum.min / n),
    salario_medio: Math.round(sum.medio / n),
    salario_max: Math.round(sum.max / n),
    fonte: list.map((b) => b.fonte).filter(Boolean).join(", ") || "Média entre ramos cadastrados",
  };
}

export const MATCH_LEVEL_LABEL: Record<BenchmarkComparison["matchLevel"], string> = {
  cargo_estado_ramo_regime: "Cargo + estado + ramo + regime (match exato)",
  cargo_estado_regime: "Cargo + estado + regime (média entre ramos)",
  cargo_regime: "Cargo + regime de contratação (média geral)",
  cargo: "Cargo (média entre regimes/estados cadastrados)",
  nenhum: "Sem benchmark cadastrado",
};

export const STATUS_LABEL: Record<FaixaStatus, string> = {
  abaixo: "Abaixo",
  dentro: "Dentro da faixa",
  acima: "Acima",
  sem_dado: "Sem dado",
};

export const STATUS_TONE: Record<FaixaStatus, "bad" | "good" | "warn" | "neutral"> = {
  abaixo: "bad",
  dentro: "good",
  acima: "warn",
  sem_dado: "neutral",
};
