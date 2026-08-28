// Motor de cálculo do Relatório Comportamental DISC (formato "Estendido",
// inspirado no relatório da Sólides). Recebe os dados de uma avaliação DISC já
// salva (scores normalizados + respostas brutas dos 24 blocos, respondidos
// nas duas rodadas "como você se vê" e "como os outros te veem") e calcula
// todas as seções do relatório: percentuais, comparação de percepção,
// gráfico de perfil atual x natural x ambiente, indicadores situacionais,
// competências, área de talentos e os textos de cada seção.
//
// Observação sobre metodologia: os indicadores situacionais, o gráfico de
// competências e a área de talentos usam fórmulas próprias deste sistema,
// derivadas do próprio perfil D/I/S/C do colaborador — não são os algoritmos
// proprietários da Sólides (que não são públicos). Já os percentuais "como
// você se vê" e "como os outros te veem" vêm diretamente das respostas reais
// das duas rodadas do questionário, sem fórmula estimada.
//
// Fundamentação das fórmulas próprias (indicadores, competências e área de
// talentos): em vez de pesos arbitrários, elas usam dois eixos compostos —
// "ritmo" (D+I, ativo/rápido, vs. S+C, ponderado/constante) e "foco"
// (D+C, tarefa/questionador, vs. I+S, pessoas/receptivo) — que correspondem
// à estrutura circumplex de dois eixos ortogonais do modelo original de
// Marston (dominância percebida sobre o ambiente x favorabilidade do
// ambiente), confirmada por análise de cluster em amostra de ~48 mil
// respondentes (Cloverleaf, "DISC Assessment Construct Validity"). Os pesos
// que cruzam fatores (ex.: D reduzindo empatia) usam a direção das
// correlações encontradas entre D/I/S/C e o modelo Big Five/OCEAN em estudo
// comparativo (123test, "DISC vs Big Five"): D correlaciona com mais
// Extroversão e menos Amabilidade; I com mais Extroversão e menos
// Neuroticismo; S com menos Extroversão e mais Amabilidade; C com menos
// Extroversão e mais Neuroticismo. Mesmo assim, o DISC é um instrumento
// ipsativo (escolha forçada) — a literatura mostra boa confiabilidade
// teste-reteste, mas validade de construto mais fraca que instrumentos
// dimensionais como o Big Five, e os quatro fatores não são estatisticamente
// independentes entre si. Por isso estes números devem ser lidos como
// estimativas de apoio, não como medição psicométrica precisa.

import { FACTORS, FACTOR_NAME, type DiscLetter } from "@/data/discWords";
import {
  ARCHETYPE_NAME,
  AREA_TALENTOS,
  COMPETENCIAS,
  type DiscCtx,
  ambienteTrabalho,
  desempenhoTarefas,
  desvantagens,
  estiloComunicacao,
  estiloGestaoRequerido,
  estiloLideranca,
  estiloVendas,
  fatoresAfastamento,
  fatoresMotivacionais,
  forcasEPontosAtencao,
  formaBuscaResultados,
  habilidadesBasicas,
  habilidadesComuns,
  necessidadesBasicas,
  nomePerfil,
  organizacaoPlanejamento,
  perguntasEntrevista,
  reacaoPressao,
  relacaoMudancas,
  relacionamentos,
  relacionandoOutros,
  retratoComportamental,
  subCaracteristicas,
  sumarioExecutivo,
  tomandoDecisoes,
  valorizaOutrosPor,
  vantagens,
} from "@/lib/discReportContent";

export interface RespostaBloco {
  block: number;
  self: DiscLetter;
  others: DiscLetter;
  /** Tempo de resposta (ms) de cada rodada neste bloco. Opcional para manter
   * compatibilidade com avaliações salvas antes desta funcionalidade. */
  tempoSelfMs?: number;
  tempoOthersMs?: number;
}

export interface DiscReportInput {
  nome: string;
  norm: Record<DiscLetter, number>; // "perfil atual" (média entre como você se vê e como os outros te veem)
  primary: DiscLetter;
  secondary: DiscLetter;
  respostas: RespostaBloco[];
  cargoTitulo?: string | null;
  compatibilidadeCargo?: number | null;
  dataAplicacao?: string | null;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function nivel100(score: number, generoFeminino = false) {
  const s = clamp(score);
  if (s < 15) return generoFeminino ? "Muito Baixa" : "Muito Baixo";
  if (s < 30) return generoFeminino ? "Baixa" : "Baixo";
  if (s < 45) return generoFeminino ? "Normal Baixa" : "Normal Baixo";
  if (s < 55) return generoFeminino ? "Normal Alta" : "Normal Alto";
  if (s < 70) return generoFeminino ? "Alta" : "Alto";
  if (s < 85) return generoFeminino ? "Muito Alta" : "Muito Alto";
  return generoFeminino ? "Extremamente Alta" : "Extremamente Alto";
}

function nivelPercentual(pct: number) {
  if (pct < 15) return "MUITO BAIXO";
  if (pct < 20) return "BAIXO";
  if (pct < 25) return "NORMAL BAIXO";
  if (pct < 30) return "NORMAL ALTO";
  if (pct < 35) return "ALTO";
  return "MUITO ALTO";
}

// ---------- confiabilidade das respostas, a partir do tempo de resposta ----
// A literatura DISC específica não publica um limiar validado de "tempo
// ideal de resposta" por item — isso não é um achado psicométrico
// disponível. O que é bem estabelecido é a prática geral de pesquisa por
// questionário: tempo de resposta como indicador de qualidade do dado.
// Respostas extremamente rápidas ("speeding") costumam sinalizar clique
// automático / baixo engajamento — em pesquisa de mercado, abaixo de ~2s por
// item já costuma ser tratado como resposta não refletida. Respostas muito
// lentas sugerem hesitação ou edição consciente da escolha — o que pesa
// especialmente aqui, já que o formato de escolha forçada do DISC pressupõe
// reação relativamente espontânea ("a primeira palavra que combina"), não
// uma decisão calculada. Por isso os limiares abaixo (1,5s e 25s) são um
// critério emprestado da metodologia geral de pesquisa, não um achado
// específico de estudos DISC — e o resultado entra no relatório como um
// indicador de confiabilidade da coleta, não como um ajuste automático dos
// escores D/I/S/C: não há base científica para recalcular o perfil com base
// no tempo, só para sinalizar quando ele merece uma leitura mais cautelosa.
const TEMPO_MIN_SAUDAVEL_MS = 1500;
const TEMPO_MAX_SAUDAVEL_MS = 25000;

function computeConfiabilidade(respostas: RespostaBloco[]) {
  const tempos: number[] = [];
  respostas.forEach((r) => {
    if (typeof r.tempoSelfMs === "number") tempos.push(r.tempoSelfMs);
    if (typeof r.tempoOthersMs === "number") tempos.push(r.tempoOthersMs);
  });
  if (tempos.length === 0) return null; // avaliações salvas antes desta funcionalidade não têm tempo registrado

  const rapidas = tempos.filter((t) => t < TEMPO_MIN_SAUDAVEL_MS).length;
  const lentas = tempos.filter((t) => t > TEMPO_MAX_SAUDAVEL_MS).length;
  const saudaveis = tempos.length - rapidas - lentas;
  const tempoMedioSeg = Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length / 100)) / 10;
  const pctSaudavel = Math.round((saudaveis / tempos.length) * 100);

  let leitura: string;
  if (pctSaudavel >= 85) {
    leitura = "A maior parte das respostas foi dada em um ritmo consistente com reação espontânea — bom sinal de precisão para este resultado.";
  } else if (rapidas >= lentas && rapidas > 0) {
    leitura = `${rapidas} de ${tempos.length} respostas foram dadas muito rapidamente (abaixo de ${TEMPO_MIN_SAUDAVEL_MS / 1000}s) — pode indicar respostas no automático, reduzindo um pouco a precisão do resultado.`;
  } else if (lentas > 0) {
    leitura = `${lentas} de ${tempos.length} respostas levaram mais tempo que o esperado (acima de ${TEMPO_MAX_SAUDAVEL_MS / 1000}s) — pode indicar hesitação ou tentativa de "acertar" a resposta em vez de reação espontânea, o que reduz um pouco a precisão nessas partes.`;
  } else {
    leitura = "O ritmo de resposta variou, mas sem um padrão forte de pressa ou hesitação.";
  }

  return { tempoMedioSeg, rapidas, lentas, saudaveis, totalRespostas: tempos.length, pctSaudavel, leitura };
}

// ---------------------------------------------------------------------------
// Análise Comportamental Detalhada (pedido da Carolina em 28/08/2026) — uma
// seção ADICIONAL, apensada ao final do relatório já existente (nenhuma
// seção anterior foi alterada). Como o restante do sistema, é geração de
// texto por regras a partir dos dados reais desta avaliação — não é uma
// chamada a IA/LLM real, por isso a UI não deve rotular isso como "Análise
// via IA". Os dois índices abaixo (pressão e adaptação) e a "roda
// comportamental" são heurísticas próprias deste sistema, adaptadas de um
// material de referência trazido pela Carolina (de outra ferramenta) — não
// são índices psicométricos validados publicamente, e devem ser lidos como
// apoio qualitativo à devolutiva, com o mesmo grau de cautela já aplicado ao
// restante dos indicadores calculados deste relatório.
// ---------------------------------------------------------------------------

const ORDEM_RODA: DiscLetter[] = ["D", "I", "S", "C"];

/** Índice de pressão: heurística que combina os fatores Executor (D) e
 * Analista (C) — os dois fatores "de tarefa" do eixo foco do circumplex
 * (D+C = tarefa/questionador, x I+S = pessoas/receptivo, já usado acima para
 * os indicadores situacionais). A ideia é que a combinação de assertividade
 * (D) com exigência de precisão (C) tende a se traduzir em mais
 * autocobrança/pressão percebida no dia a dia — tanto a pressão que a pessoa
 * exerce sobre si mesma quanto a que tende a projetar no ambiente.
 * Fórmula: (norm.D + norm.C) / 2, na mesma escala 0-100 de `norm` (que aqui,
 * por construção, tende a ficar entre ~10 e ~40 por fator, já que os quatro
 * fatores somam ~100 nesta metodologia — ver `computeDiscScores`). Por isso
 * os limiares de leitura abaixo NÃO são os mesmos 33/66 de uma escala
 * uniforme: usam a média teórica de ~25 por fator (100/4) como referência de
 * "moderado", e não um estudo publicado — é uma adaptação própria, não uma
 * medida validada.
 */
function computeIndicePressao(norm: Record<DiscLetter, number>) {
  const valor = clamp((norm.D + norm.C) / 2);
  const leitura: "baixo" | "moderado" | "alto" = valor < 20 ? "baixo" : valor < 35 ? "moderado" : "alto";
  return { valor, leitura };
}

/** Índice de adaptação: magnitude da mudança entre "como você se vê" e "como
 * os outros te veem" — quanto maior, mais a pessoa parece ajustar o
 * comportamento entre o que é por natureza e o que o ambiente cobra dela
 * (ligado ao mesmo `gapPercepcao` usado no indicador "Exigência do meio",
 * mas apresentado aqui como um índice próprio, na escala pedida: soma dos
 * módulos das diferenças entre selfPct e othersPct nos 4 fatores, dividida
 * por 2 — a divisão por 2 compensa o fato de que, como os percentuais de
 * cada rodada somam ~100%, o total de "sobra" migrado de um fator para outro
 * já aparece contado duas vezes na soma bruta dos módulos).
 */
function computeIndiceAdaptacao(selfPct: Record<DiscLetter, number>, othersPct: Record<DiscLetter, number>) {
  const somaAbsoluta = ORDEM_RODA.reduce((acc, f) => acc + Math.abs(selfPct[f] - othersPct[f]), 0);
  const valor = clamp(somaAbsoluta / 2);
  const leitura: "baixa" | "moderada" | "alta" = valor < 10 ? "baixa" : valor < 22 ? "moderada" : "alta";
  return { valor, leitura };
}

/** Roda Comportamental: posiciona o perfil em um dos 8 octantes de uma roda
 * circular — os 4 arquétipos "puros" (a cada 90°, na ordem Executor(D 0°) →
 * Comunicador(I 90°) → Planejador(S 180°) → Analista(C 270°), a mesma ordem
 * do circumplex de Marston usado no restante deste arquivo) e os 4 octantes
 * "mistos" entre arquétipos adjacentes (a 45°, 135°, 225°, 315°).
 *
 * Quando o fator secundário desta avaliação é adjacente ao primário na roda
 * (ex.: D com I, ou C com D), o ponteiro se desloca do octante puro do
 * primário em direção ao octante misto correspondente, proporcionalmente ao
 * peso do secundário: ângulo = ânguloPrimário + direção × 90° × [
 * norm(vizinho) / (norm(primário) + norm(vizinho)) ]. Quando o secundário é
 * o fator OPOSTO ao primário na roda (D↔S ou I↔C — não há octante misto
 * "direto" entre opostos), o deslocamento usa, em vez do secundário, o maior
 * entre os dois vizinhos adjacentes do primário — para o ponteiro sempre
 * inclinar para um octante existente na roda.
 */
function computeRodaComportamental(norm: Record<DiscLetter, number>, primary: DiscLetter, secondary: DiscLetter) {
  const idxPrimario = ORDEM_RODA.indexOf(primary);
  const anguloPrimario = idxPrimario * 90;
  const vizinhoAntes = ORDEM_RODA[(idxPrimario + 3) % 4]; // -1 na roda (sentido anti-horário)
  const vizinhoDepois = ORDEM_RODA[(idxPrimario + 1) % 4]; // +1 na roda (sentido horário)
  const secundarioEhOposto = secondary !== vizinhoAntes && secondary !== vizinhoDepois;

  let vizinhoAlvo: DiscLetter;
  let direcao: 1 | -1;
  if (!secundarioEhOposto) {
    vizinhoAlvo = secondary;
    direcao = secondary === vizinhoDepois ? 1 : -1;
  } else {
    // Fator secundário oposto: inclina para o vizinho adjacente mais forte.
    if (norm[vizinhoDepois] >= norm[vizinhoAntes]) {
      vizinhoAlvo = vizinhoDepois;
      direcao = 1;
    } else {
      vizinhoAlvo = vizinhoAntes;
      direcao = -1;
    }
  }

  const pesoPrimario = norm[primary];
  const pesoVizinho = norm[vizinhoAlvo];
  const fracao = pesoPrimario + pesoVizinho > 0 ? pesoVizinho / (pesoPrimario + pesoVizinho) : 0;
  const anguloGraus = Math.round((anguloPrimario + direcao * 90 * fracao + 360) % 360);

  // 8 segmentos fixos da roda (índice 0 = Executor puro em 0°, avançando de
  // 45° em 45°), usados pela UI para desenhar e destacar o segmento certo.
  const segmentos = [
    { index: 0, anguloCentro: 0, label: `${ARCHETYPE_NAME.D} puro` },
    { index: 1, anguloCentro: 45, label: `${ARCHETYPE_NAME.D} com apoio em ${ARCHETYPE_NAME.I}` },
    { index: 2, anguloCentro: 90, label: `${ARCHETYPE_NAME.I} puro` },
    { index: 3, anguloCentro: 135, label: `${ARCHETYPE_NAME.I} com apoio em ${ARCHETYPE_NAME.S}` },
    { index: 4, anguloCentro: 180, label: `${ARCHETYPE_NAME.S} puro` },
    { index: 5, anguloCentro: 225, label: `${ARCHETYPE_NAME.S} com apoio em ${ARCHETYPE_NAME.C}` },
    { index: 6, anguloCentro: 270, label: `${ARCHETYPE_NAME.C} puro` },
    { index: 7, anguloCentro: 315, label: `${ARCHETYPE_NAME.C} com apoio em ${ARCHETYPE_NAME.D}` },
  ];
  const segmentoIndex = Math.round(anguloGraus / 45) % 8;

  return {
    anguloGraus,
    segmentoIndex,
    octanteAtual: segmentos[segmentoIndex].label,
    segmentos,
  };
}

export function buildDiscReport(input: DiscReportInput) {
  const { norm, primary, secondary, respostas } = input;

  // ---------- contagens brutas das duas rodadas ----------
  const selfCount: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  const othersCount: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  respostas.forEach((r) => {
    selfCount[r.self] = (selfCount[r.self] ?? 0) + 1;
    othersCount[r.others] = (othersCount[r.others] ?? 0) + 1;
  });
  const totalSelf = respostas.length || 24;
  const totalOthers = respostas.length || 24;

  // ---------- percentuais reais das duas rodadas (somam ~100% cada) ----------
  const selfPct: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  const othersPct: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  const percentualAtual: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 };
  FACTORS.forEach((f) => {
    selfPct[f] = Math.round((selfCount[f] / totalSelf) * 10000) / 100;
    othersPct[f] = Math.round((othersCount[f] / totalOthers) * 10000) / 100;
    percentualAtual[f] = Math.round(((selfCount[f] + othersCount[f]) / (totalSelf + totalOthers)) * 10000) / 100;
  });

  // ---------- comparação de percepção: como você se vê x como os outros te veem ----------
  const comparacaoPercepcao = FACTORS.map((f) => ({
    fator: f,
    nome: FACTOR_NAME[f],
    comoSeVe: selfPct[f],
    comoOsOutrosVeem: othersPct[f],
    delta: Math.round((othersPct[f] - selfPct[f]) * 10) / 10,
  }));

  // ---------- indicadores situacionais ----------
  // "Ritmo" e "foco" são os dois eixos ortogonais do circumplex clássico do
  // DISC (Marston): ritmo = ativo/rápido (D+I) x ponderado/constante (S+C);
  // foco = tarefa/questionador (D+C) x pessoas/receptivo (I+S). A distância
  // de cada eixo até o centro (50) mede o quão definido/intenso é o perfil.
  const ritmo = clamp(50 + (norm.D + norm.I - norm.S - norm.C) / 4);
  const foco = clamp(50 + (norm.D + norm.C - norm.I - norm.S) / 4);
  const intensidadePerfil = clamp(Math.sqrt((ritmo - 50) ** 2 + (foco - 50) ** 2) * 2);
  const gapPercepcao = FACTORS.reduce((acc, f) => acc + Math.abs(selfPct[f] - othersPct[f]), 0) / 4;

  const exigenciaDoMeio = clamp(gapPercepcao * 1.9);
  const indicadoresSituacionais = [
    {
      nome: "Energia",
      genero: true,
      // Ritmo = eixo ativo/rápido x ponderado/constante de Marston — é, por
      // definição, o eixo de energia comportamental do modelo.
      valor: ritmo,
      descricao: "Indica o pique para o trabalho, a capacidade de mudar e a habilidade de absorver o estresse mais facilmente.",
    },
    {
      nome: "Exigência do meio",
      genero: true,
      valor: exigenciaDoMeio,
      descricao: "Mede o quão diferente é a forma como o colaborador se vê da forma como as pessoas ao redor o percebem — quanto maior a diferença, mais o ambiente está cobrando um comportamento distinto do natural.",
    },
    {
      nome: "Aproveitamento",
      genero: true,
      valor: clamp(100 - exigenciaDoMeio),
      descricao: "Indica se as habilidades do perfil estão sendo bem aproveitadas nas atividades atuais.",
    },
    {
      nome: "Moral",
      genero: true,
      // D correlaciona com mais Extroversão/autoconfiança e menos Amabilidade
      // (assertividade); I correlaciona com mais Extroversão e menos
      // Neuroticismo (estabilidade emocional) — ambos sustentam autoaprovação.
      valor: clamp(50 + (norm.D - 50) * 0.35 + (norm.I - 50) * 0.45),
      descricao: "Indica o nível de autoaprovação da pessoa em termos de desempenho profissional.",
    },
    {
      nome: "Positividade",
      genero: true,
      // I correlaciona negativamente com Neuroticismo (mais estabilidade
      // emocional/otimismo); C correlaciona positivamente com Neuroticismo
      // (mais vigilância/preocupação com erros).
      valor: clamp(50 + (norm.I - 50) * 0.5 - (norm.C - 50) * 0.35),
      descricao: "Mede a autoestima do indivíduo em questões pessoais e profissionais.",
    },
    {
      nome: "Flexibilidade",
      genero: true,
      // I (abertura social) soma; S (Estabilidade = resistência a mudanças,
      // por definição teórica clássica) e C (apego a regras/estrutura) subtraem.
      valor: clamp(50 + (norm.I - 50) * 0.4 - (norm.S - 50) * 0.3 - (norm.C - 50) * 0.25),
      descricao: "Mede o quanto a pessoa pode mudar seu comportamento e com que facilidade pode fazê-lo.",
    },
    {
      nome: "Amplitude",
      genero: true,
      // Distância do perfil ao centro do circumplex (ritmo x foco) — quanto
      // mais definido/extremo o perfil, maior o impacto que costuma causar
      // no ambiente à sua volta.
      valor: intensidadePerfil,
      descricao: "Indica o quão forte é a importância do ambiente de trabalho na produtividade e o quanto a pessoa impacta o grupo onde está inserida.",
    },
    {
      nome: "Automotivação",
      genero: true,
      // D (assertividade/independência) é o preditor central de automotivação
      // no modelo; I (entusiasmo) contribui em menor peso.
      valor: clamp(50 + (norm.D - 50) * 0.5 + (norm.I - 50) * 0.3),
      descricao: "É a energia natural do perfil comportamental, o potencial de energia que pode ser entregue no trabalho.",
    },
    {
      nome: "Incitabilidade",
      genero: false,
      // I (Extroversão/responsividade a estímulos sociais) e D (rapidez de
      // reação, baixa Amabilidade/paciência) — ambos aumentam a reatividade.
      valor: clamp(50 + (norm.I - 50) * 0.5 + (norm.D - 50) * 0.35),
      descricao: "É o potencial de reação a estímulos — o quanto a pessoa se acende diante de uma nova ideia ou desafio.",
    },
  ].map((i) => ({ ...i, nivel: nivel100(i.valor, i.genero) }));

  // ---------- competências (20) ----------
  const competencias = COMPETENCIAS.map((c) => {
    const valor = clamp(c.base + FACTORS.reduce((acc, f) => acc + norm[f] * c.pesos[f], 0));
    return { nome: c.nome, descricao: c.descricao, valor, nivel: nivel100(valor, true) };
  });

  // ---------- área de talentos (13) ----------
  const areaTalentos = AREA_TALENTOS.map((t) => {
    let sumSq = 0;
    FACTORS.forEach((f) => {
      const d = norm[f] - t.ideal[f];
      sumSq += d * d;
    });
    const dist = Math.sqrt(sumSq);
    const valor = clamp(100 - (dist / 200) * 100);
    return { nome: t.nome, descricao: t.descricao, valor, nivel: nivel100(valor) };
  }).sort((a, b) => b.valor - a.valor);

  // ---------- percentuais + nível para a barra de capa (perfil atual) ----------
  // Rótulos do "Perfil DISC" usam o nome do arquétipo (Executor, Comunicador,
  // Planejador, Analista) em vez do nome técnico do fator (Dominância,
  // Influência, Estabilidade, Conformidade) — pedido da Carolina para bater
  // com o formato do relatório de referência.
  const perfilPercentual = FACTORS.map((f) => ({
    fator: f,
    nome: ARCHETYPE_NAME[f],
    pct: percentualAtual[f],
    nivel: nivelPercentual(percentualAtual[f]),
  })).sort((a, b) => b.pct - a.pct);

  // ---------- contexto usado para personalizar os textos com os números
  // reais desta avaliação (nome + percentuais), em vez de um texto fixo por
  // par de fatores primário/secundário ----------
  const ctx: DiscCtx = { nome: input.nome, norm, selfPct, othersPct };

  // ---------- confiabilidade da coleta, a partir do tempo de resposta ----------
  const confiabilidadeResposta = computeConfiabilidade(respostas);

  // ---------- Análise Comportamental Detalhada (seção adicional) ----------
  const analiseAvancada = {
    sumarioExecutivo: sumarioExecutivo(ctx, primary, secondary, input.compatibilidadeCargo ?? null),
    retratoComportamental: retratoComportamental(ctx, primary, secondary),
    ...forcasEPontosAtencao(ctx, primary, secondary),
    ambienteIdeal: ambienteTrabalho(ctx, primary),
    perguntasEntrevista: perguntasEntrevista(ctx, primary, secondary, comparacaoPercepcao),
    indicePressao: computeIndicePressao(norm),
    indiceAdaptacao: computeIndiceAdaptacao(selfPct, othersPct),
    rodaComportamental: computeRodaComportamental(norm, primary, secondary),
  };

  return {
    nome: input.nome,
    dataAplicacao: input.dataAplicacao ?? null,
    cargoTitulo: input.cargoTitulo ?? null,
    compatibilidadeCargo: input.compatibilidadeCargo ?? null,
    primary,
    secondary,
    nomePerfil: nomePerfil(primary, secondary),
    norm,
    selfPct,
    othersPct,
    comparacaoPercepcao,
    perfilPercentual,
    indicadoresSituacionais,
    competencias,
    areaTalentos,
    confiabilidadeResposta,
    analiseAvancada,
    texto: {
      subCaracteristicas: subCaracteristicas(primary, secondary),
      habilidadesBasicas: habilidadesBasicas(ctx, primary, secondary),
      habilidadesComuns: habilidadesComuns(ctx, primary, secondary),
      vantagens: vantagens(ctx, primary, secondary),
      desvantagens: desvantagens(ctx, primary, secondary),
      fatoresMotivacionais: fatoresMotivacionais(ctx, primary, secondary),
      valorizaOutrosPor: valorizaOutrosPor(primary, secondary),
      necessidadesBasicas: necessidadesBasicas(primary, secondary),
      fatoresAfastamento: fatoresAfastamento(primary, secondary),
      formaBuscaResultados: formaBuscaResultados(ctx, primary),
      organizacaoPlanejamento: organizacaoPlanejamento(ctx, primary, secondary),
      reacaoPressao: reacaoPressao(ctx, primary),
      relacaoMudancas: relacaoMudancas(ctx, primary),
      relacionamentos: relacionamentos(ctx, primary, secondary),
      relacionandoOutros: relacionandoOutros(ctx, primary),
      tomandoDecisoes: tomandoDecisoes(ctx, primary),
      estiloGestaoRequerido: estiloGestaoRequerido(ctx, primary, secondary),
      estiloLideranca: estiloLideranca(ctx, primary, secondary),
      estiloComunicacao: estiloComunicacao(ctx, primary, secondary),
      ambienteTrabalho: ambienteTrabalho(ctx, primary),
      desempenhoTarefas: desempenhoTarefas(ctx, primary),
      estiloVendas: estiloVendas(ctx, primary, secondary),
    },
  };
}

export type DiscReportData = ReturnType<typeof buildDiscReport>;
