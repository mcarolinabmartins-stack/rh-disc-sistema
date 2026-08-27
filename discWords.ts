// Banco de palavras do questionário DISC (24 blocos "mais / menos se parece comigo")
// e funções puras de pontuação — usados pelo componente de aplicação do DISC.

export type DiscLetter = "D" | "I" | "S" | "C";

export const WORDS: Record<DiscLetter, string[]> = {
  D: ["Decidido", "Direto", "Competitivo", "Exigente", "Ousado", "Determinado", "Assertivo", "Independente", "Corajoso", "Impaciente", "Firme", "Audacioso", "Autoritário", "Persistente", "Confiante", "Forte", "Pioneiro", "Desafiador", "Ambicioso", "Resoluto", "Enérgico", "Dominante", "Impositivo", "Aventureiro"],
  I: ["Comunicativo", "Entusiasta", "Sociável", "Persuasivo", "Otimista", "Expressivo", "Amigável", "Espontâneo", "Carismático", "Extrovertido", "Falante", "Animado", "Inspirador", "Caloroso", "Popular", "Convincente", "Divertido", "Cativante", "Impulsivo", "Encantador", "Generoso", "Charmoso", "Envolvente", "Efusivo"],
  S: ["Paciente", "Calmo", "Leal", "Consistente", "Gentil", "Previsível", "Cooperativo", "Amável", "Tranquilo", "Constante", "Confiável", "Modesto", "Compreensivo", "Prestativo", "Discreto", "Sereno", "Complacente", "Fiel", "Dócil", "Bondoso", "Acolhedor", "Estável", "Ponderado", "Pacato"],
  C: ["Preciso", "Analítico", "Cuidadoso", "Organizado", "Detalhista", "Sistemático", "Cauteloso", "Lógico", "Criterioso", "Disciplinado", "Meticuloso", "Correto", "Perfeccionista", "Formal", "Reservado", "Prudente", "Rigoroso", "Metódico", "Objetivo", "Exato", "Diplomático", "Conservador", "Crítico", "Investigativo"],
};

export const FACTORS: DiscLetter[] = ["D", "I", "S", "C"];

export const FACTOR_NAME: Record<DiscLetter, string> = {
  D: "Dominância",
  I: "Influência",
  S: "Estabilidade",
  C: "Conformidade",
};

export const FACTOR_DESC: Record<DiscLetter, string> = {
  D: "Direto(a), decidido(a) e orientado(a) a resultados. Gosta de desafios e assume riscos com naturalidade.",
  I: "Comunicativo(a), entusiasta e otimista. Constrói relacionamentos com facilidade e motiva as pessoas ao redor.",
  S: "Paciente, leal e consistente. Prefere ambientes previsíveis e cooperativos.",
  C: "Analítico(a), preciso(a) e organizado(a). Busca qualidade e decide com base em dados.",
};

export interface DiscBlockItem {
  word: string;
  factor: DiscLetter;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const TOTAL_BLOCKS = 24;

export function buildBlocks(): DiscBlockItem[][] {
  const blocks: DiscBlockItem[][] = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const items: DiscBlockItem[] = FACTORS.map((f) => ({ word: WORDS[f][i], factor: f }));
    blocks.push(shuffle(items));
  }
  return blocks;
}

export interface DiscAnswer {
  most: DiscLetter | null;
  least: DiscLetter | null;
}

export function computeDiscScores(answers: Record<number, DiscAnswer>) {
  const raw: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  FACTORS.forEach((f) => {
    let most = 0;
    let least = 0;
    Object.values(answers).forEach((a) => {
      if (a.most === f) most++;
      if (a.least === f) least++;
    });
    raw[f] = most - least;
  });
  const norm: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  FACTORS.forEach((f) => {
    norm[f] = Math.round(((raw[f] + TOTAL_BLOCKS) / (TOTAL_BLOCKS * 2)) * 100);
  });
  const order = FACTORS.slice().sort((a, b) => norm[b] - norm[a]);
  return { raw, norm, primary: order[0], secondary: order[1] };
}

export function compatibilityWithCargo(
  norm: Record<DiscLetter, number>,
  ideal: { disc_ideal_d: number; disc_ideal_i: number; disc_ideal_s: number; disc_ideal_c: number }
) {
  const idealMap: Record<DiscLetter, number> = {
    D: ideal.disc_ideal_d,
    I: ideal.disc_ideal_i,
    S: ideal.disc_ideal_s,
    C: ideal.disc_ideal_c,
  };
  let sumSq = 0;
  FACTORS.forEach((f) => {
    const d = norm[f] - idealMap[f];
    sumSq += d * d;
  });
  const dist = Math.sqrt(sumSq);
  const MAX_DIST = 200; // sqrt(4 * 100^2)
  return Math.max(0, Math.round(100 - (dist / MAX_DIST) * 100));
}
