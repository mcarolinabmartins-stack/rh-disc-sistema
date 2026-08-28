// Biblioteca de conteúdo do Relatório Comportamental DISC, no formato/estilo
// do relatório "Estendido" da Sólides: nomes de arquétipo, bancos de frases por
// fator (D/I/S/C) para cada seção do relatório, competências e área de talentos.
//
// Importante: os textos abaixo são redação própria deste sistema — não são cópia
// do conteúdo proprietário da Sólides.
//
// Personalização (revisão pedida por Carolina em 28/08/2026): antes, cada
// parágrafo era só a concatenação fixa do banco de frases do fator primário +
// secundário — então duas pessoas com o mesmo par de fatores dominantes
// recebiam o texto idêntico, mesmo com percentuais bem diferentes. Agora cada
// função de texto recebe o "contexto" (nome + percentuais reais desta pessoa)
// e monta uma abertura autoral que cita os números da própria avaliação e
// varia conforme a "clareza" do perfil: quando um fator domina claramente
// sobre o outro (gap ≥ 18 pontos) o texto foca só nesse traço; quando os dois
// estão próximos (gap < 8 pontos), o texto explicita que é um perfil
// combinado e traz as duas descrições. O banco de frases por fator continua
// como a base do conteúdo (é a parte validada teoricamente), mas a abertura e
// a escolha de quanto do banco secundário aparecer são dirigidas pelos dados
// reais de cada avaliação.

import { FACTOR_NAME, type DiscLetter } from "@/data/discWords";

export const ARCHETYPE_NAME: Record<DiscLetter, string> = {
  D: "Executor",
  I: "Comunicador",
  S: "Planejador",
  C: "Analista",
};

export function nomePerfil(primary: DiscLetter, secondary: DiscLetter) {
  return `${ARCHETYPE_NAME[primary]} ${ARCHETYPE_NAME[secondary]}`;
}

type PorLetra<T> = Record<DiscLetter, T>;

/** Contexto real desta avaliação, usado para personalizar cada parágrafo. */
export interface DiscCtx {
  nome: string;
  norm: PorLetra<number>;
  selfPct: PorLetra<number>;
  othersPct: PorLetra<number>;
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "A pessoa avaliada";
}

type Clareza = "definido" | "moderado" | "combinado";

/** Mede o quão "puro" (um fator claramente à frente) ou "combinado" (dois
 * fatores próximos, com traços dos dois) é o resultado desta pessoa. */
function clarezaPerfil(norm: PorLetra<number>, p: DiscLetter, s: DiscLetter): Clareza {
  const gap = norm[p] - norm[s];
  if (gap >= 18) return "definido";
  if (gap >= 8) return "moderado";
  return "combinado";
}

function intensidadeFator(v: number) {
  if (v >= 45) return "muito forte";
  if (v >= 35) return "forte";
  if (v >= 25) return "moderada";
  return "discreta";
}

function composeText(bank: PorLetra<string>, p: DiscLetter, s: DiscLetter, clareza: Clareza) {
  if (clareza === "definido") return bank[p];
  return `${bank[p]} ${bank[s]}`.trim();
}

function composeList(bank: PorLetra<string[]>, primary: DiscLetter, secondary: DiscLetter) {
  const items = [...bank[primary].slice(0, 2), ...bank[secondary].slice(0, 1)];
  return Array.from(new Set(items));
}

/** Abertura autoral para parágrafos combinando fator primário + secundário.
 * Cada seção recebe um `variante` (0-2) diferente para não repetir sempre a
 * mesma frase-modelo com o mesmo percentual em destaque — só uma parte das
 * seções cita o número explicitamente, as outras usam o dado de forma
 * qualitativa (intensidade, ordem dos fatores), mas todas continuam
 * derivadas dos percentuais reais desta avaliação. */
function abre(ctx: DiscCtx, p: DiscLetter, s: DiscLetter, acao: string, variante: 0 | 1 | 2 = 0) {
  const nome = primeiroNome(ctx.nome);
  const clareza = clarezaPerfil(ctx.norm, p, s);

  if (clareza === "definido") {
    const opcoes = [
      `Com ${FACTOR_NAME[p]} em ${ctx.norm[p]}% — bem à frente dos demais fatores —, ${nome} ${acao} sobretudo com o estilo ${ARCHETYPE_NAME[p]}.`,
      `${nome} tem o estilo ${ARCHETYPE_NAME[p]} claramente predominante nesta avaliação, e isso aparece em como ${nome} ${acao}.`,
      `${FACTOR_NAME[p]} é, de longe, o traço mais forte de ${nome} no momento — o que marca fortemente como ${nome} ${acao}.`,
    ];
    return opcoes[variante];
  }
  if (clareza === "moderado") {
    const opcoes = [
      `Com ${FACTOR_NAME[p]} (${ctx.norm[p]}%) à frente de ${FACTOR_NAME[s]} (${ctx.norm[s]}%), ${nome} ${acao} como ${ARCHETYPE_NAME[p]}, com traços de ${ARCHETYPE_NAME[s]}.`,
      `${nome} se apoia principalmente no estilo ${ARCHETYPE_NAME[p]}, com o estilo ${ARCHETYPE_NAME[s]} aparecendo em segundo plano — e isso se nota em como ${nome} ${acao}.`,
      `Entre os quatro fatores, ${FACTOR_NAME[p]} lidera com folga sobre ${FACTOR_NAME[s]} no perfil de ${nome}, definindo em boa parte como ${nome} ${acao}.`,
    ];
    return opcoes[variante];
  }
  const opcoes = [
    `Com ${FACTOR_NAME[p]} e ${FACTOR_NAME[s]} quase empatados (${ctx.norm[p]}% e ${ctx.norm[s]}%), ${nome} ${acao} misturando os estilos ${ARCHETYPE_NAME[p]} e ${ARCHETYPE_NAME[s]}.`,
    `${nome} combina traços de ${ARCHETYPE_NAME[p]} e ${ARCHETYPE_NAME[s]} quase na mesma medida — um perfil sem um único traço isolado dominando como ${nome} ${acao}.`,
    `Não há um fator claramente à frente entre ${FACTOR_NAME[p]} e ${FACTOR_NAME[s]} no perfil de ${nome}, então como ${nome} ${acao} costuma variar conforme o contexto.`,
  ];
  return opcoes[variante];
}

/** Abertura autoral para parágrafos de um único fator — cita a intensidade
 * real desse fator nesta avaliação, também variando a frase-modelo entre
 * as seções. */
function abreSimples(ctx: DiscCtx, p: DiscLetter, acao: string, variante: 0 | 1 | 2 = 0) {
  const nome = primeiroNome(ctx.nome);
  const intens = intensidadeFator(ctx.norm[p]);
  const opcoes = [
    `O fator ${FACTOR_NAME[p]} aparece de forma ${intens} no perfil de ${nome} (${ctx.norm[p]}% no perfil atual), o que molda como ${nome} ${acao}.`,
    `Com uma presença ${intens} de ${FACTOR_NAME[p]}, ${nome} tende a ${acao} de um jeito característico do estilo ${ARCHETYPE_NAME[p]}.`,
    `${nome} carrega uma dose ${intens} de ${FACTOR_NAME[p]} no perfil atual, o que costuma aparecer em como ${nome} ${acao}.`,
  ];
  return opcoes[variante];
}

// ---------------------------------------------------------------------------
// Listas curtas (sub-características, valoriza os outros por, necessidades
// básicas, fatores de afastamento)
// ---------------------------------------------------------------------------

const SUBCARACTERISTICAS: PorLetra<string[]> = {
  D: ["Determinação", "Iniciativa", "Firmeza"],
  I: ["Entusiasmo", "Persuasão", "Sociabilidade"],
  S: ["Paciência", "Lealdade", "Constância"],
  C: ["Exatidão", "Sensibilidade a padrões", "Conhecimento técnico"],
};

const VALORIZA_OUTROS_POR: PorLetra<string[]> = {
  D: ["resultados", "coragem para decidir", "eficiência"],
  I: ["entusiasmo", "criatividade", "boa comunicação"],
  S: ["lealdade", "cooperação", "constância"],
  C: ["competência", "capricho", "responsabilidade"],
};

const NECESSIDADES_BASICAS: PorLetra<string[]> = {
  D: ["autonomia", "desafios", "poder de decisão"],
  I: ["reconhecimento", "interação social", "liberdade de expressão"],
  S: ["segurança", "estabilidade", "harmonia"],
  C: ["segurança", "organização", "reconhecimento pela qualidade do trabalho"],
};

const FATORES_AFASTAMENTO: PorLetra<string[]> = {
  D: ["falta de autonomia", "lentidão", "microgerenciamento"],
  I: ["rotina excessiva", "isolamento", "ambientes muito rígidos"],
  S: ["mudanças bruscas", "pressão constante", "conflitos abertos"],
  C: ["indisciplina", "desorganização", "pressão por rapidez sem qualidade"],
};

// ---------------------------------------------------------------------------
// Parágrafos (habilidades, vantagens, desvantagens, estilos, etc.)
// ---------------------------------------------------------------------------

const HABILIDADES_BASICAS: PorLetra<string> = {
  D: "Tem facilidade para tomar decisões rápidas e assumir riscos calculados, preferindo agir a esperar pelo cenário ideal.",
  I: "Comunica-se com facilidade, contagia o ambiente com entusiasmo e constrói relacionamentos novos rapidamente.",
  S: "Mantém constância e paciência mesmo sob rotina, sendo um ponto de estabilidade para o time.",
  C: "Interessa-se por áreas que exigem detalhe e precisão, domina bem assuntos que requerem sofisticação técnica.",
};

const HABILIDADES_COMUNS: PorLetra<string> = {
  D: "É determinado(a) e não teme o trabalho duro. Questiona o status quo e fala o que pensa, sem se intimidar diante de conflitos quando julga necessário defender um ponto.",
  I: "Tem facilidade para influenciar e motivar as pessoas ao redor, usando o otimismo como ferramenta para engajar o grupo em torno de um objetivo comum.",
  S: "É um bom ouvinte, confiável e consistente. Prefere resolver as coisas com calma, evitando decisões precipitadas que possam gerar instabilidade.",
  C: "Mantém padrões elevados de qualidade para si e para os outros, reconhecendo problemas antes que se tornem visíveis para o restante da equipe.",
};

const VANTAGENS: PorLetra<string> = {
  D: "Como vantagem, é competitivo(a) e motivado(a) a cumprir metas, sem se intimidar com obstáculos e sem depender da aprovação alheia para agir.",
  I: "Contagia o ambiente com otimismo, cria pontes entre pessoas e áreas diferentes e sabe comunicar ideias de forma envolvente.",
  S: "Traz previsibilidade e confiança ao time, cumprindo o que promete e mantendo a cooperação mesmo em momentos de tensão.",
  C: "Tem forte capacidade analítica, identifica riscos e inconsistências antes dos demais e entrega trabalho com alto padrão de qualidade.",
};

const DESVANTAGENS: PorLetra<string> = {
  D: "Como desvantagem, pode parecer impaciente ou pouco atento a sentimentos alheios ao priorizar o resultado sobre o processo.",
  I: "Pode perder o foco em detalhes e prazos ao se envolver demais com o relacionamento e a conversa.",
  S: "Pode demorar para se posicionar diante de mudanças e evitar conflitos necessários por priorizar a harmonia.",
  C: "Pode ser excessivamente crítico(a) consigo e com os outros, travando decisões à espera de mais informação do que o necessário.",
};

const FATORES_MOTIVACIONAIS: PorLetra<string> = {
  D: "É motivado(a) por desafios, autonomia e pela possibilidade de ver resultados concretos do próprio trabalho.",
  I: "É motivado(a) pelo reconhecimento público, por ambientes sociais e pela liberdade para propor ideias novas.",
  S: "É motivado(a) por estabilidade, por fazer parte de um time coeso e por rotinas previsíveis.",
  C: "É motivado(a) pela perfeição e eficiência, gostando de sentir que concluiu o trabalho de forma precisa.",
};

const FORMA_BUSCA_RESULTADOS: PorLetra<string> = {
  D: "Busca resultados de forma direta e rápida, preferindo agir logo a refinar demais um plano.",
  I: "Busca resultados envolvendo pessoas, entusiasmando o time em torno da meta.",
  S: "Busca resultados de forma constante e colaborativa, evitando atalhos que comprometam a equipe.",
  C: "Busca alcançar metas com perfeição; às vezes se frustra quando não as alcança exatamente como planejado, mas recomeça.",
};

const ORGANIZACAO_PLANEJAMENTO: PorLetra<string> = {
  D: "Planeja de forma objetiva, focando no essencial para chegar ao resultado, e ajusta o plano rapidamente quando necessário.",
  I: "Planeja de forma mais flexível e intuitiva, podendo perder um pouco de estrutura quando o entusiasmo com o novo aparece.",
  S: "Organiza-se de forma metódica e constante, preferindo seguir processos já validados a improvisar.",
  C: "É muito organizado(a) e cuidadoso(a) no planejamento, com tendência a se concentrar bastante em situações que fogem do que considera correto.",
};

const REACAO_PRESSAO: PorLetra<string> = {
  D: "Sob pressão, tende a se tornar mais direto(a) e impositivo(a), podendo parecer agressivo(a) ao insistir no que considera certo.",
  I: "Sob pressão, pode se dispersar ou reagir de forma mais emotiva, buscando apoio das pessoas ao redor.",
  S: "Sob pressão muito alta, pode perder energia e o estresse pode refletir até na disposição para o trabalho.",
  C: "Sob pressão, tende a se fechar, aprofundar-se nos detalhes e evitar decisões até sentir segurança nas informações.",
};

const RELACAO_MUDANCAS: PorLetra<string> = {
  D: "Lida bem com mudanças, principalmente quando pode participar da decisão sobre o novo rumo.",
  I: "Costuma abraçar mudanças com entusiasmo, vendo nelas uma oportunidade de novidade.",
  S: "Tolera mudanças quando são previstas com antecedência; não gosta de ser pega(o) de surpresa nem de se submeter a situações de risco.",
  C: "Aceita mudanças quando há dados e lógica que as justifiquem; muda de opinião mais devagar do que os demais perfis.",
};

const RELACIONAMENTOS: PorLetra<string> = {
  D: "Nos relacionamentos, é direto(a) e não tem muita paciência com quem falta compromisso; valoriza gente que produz.",
  I: "Nos relacionamentos, é caloroso(a), sociável e costuma ter um círculo amplo de contatos.",
  S: "Nos relacionamentos, é leal e constante, preferindo um círculo mais próximo e de confiança a muitos contatos superficiais.",
  C: "Nos relacionamentos, é mais reservado(a) e seletivo(a), demorando a se abrir, mas muito confiável quando o faz.",
};

const RELACIONANDO_OUTROS: PorLetra<string> = {
  D: "Tende a ser breve e objetivo(a) na comunicação, focando no que precisa ser feito.",
  I: "Prioriza manter o relacionamento aquecido, sendo expansivo(a) e comunicativo(a) mesmo fora do necessário.",
  S: "Prefere guardar opiniões para si a não ser que seja realmente necessário compartilhá-las, priorizando a harmonia do grupo.",
  C: "É reservado(a) e prefere argumentos concretos a conversas informais, sendo seletivo(a) sobre o que compartilha.",
};

const TOMANDO_DECISOES: PorLetra<string> = {
  D: "Toma decisões rápidas e assume a responsabilidade por elas, mesmo sabendo que pode desagradar alguém.",
  I: "Toma decisões considerando o impacto nas pessoas envolvidas, às vezes de forma mais espontânea que analítica.",
  S: "Prefere tomar decisões com calma, buscando consenso e evitando mudanças bruscas.",
  C: "Toma decisões de forma cautelosa, baseada em dados; decisões maiores exigem mais tempo de análise.",
};

const ESTILO_GESTAO_REQUERIDO: PorLetra<string> = {
  D: "Um(a) gestor(a) eficaz dará espaço para agir com autonomia e proporá desafios claros, sem microgerenciar.",
  I: "Um(a) gestor(a) eficaz reconhecerá publicamente as conquistas e proporá espaços de interação e visibilidade.",
  S: "Um(a) gestor(a) eficaz explicará o motivo das mudanças com antecedência e manterá uma rotina previsível de acompanhamento.",
  C: "Um(a) gestor(a) eficaz dará tempo e informação suficientes para decisões bem embasadas, reconhecendo o cuidado técnico do trabalho.",
};

const ESTILO_LIDERANCA: PorLetra<string> = {
  D: "Como líder, mantém padrões elevados de desempenho e cobra resultados; toma decisões sem depender de aprovação alheia.",
  I: "Como líder, engaja o time pelo entusiasmo, comunica visão de forma inspiradora e valoriza o reconhecimento das pessoas.",
  S: "Como líder, constrói confiança pela constância, dá suporte próximo ao time e evita mudanças bruscas de direção.",
  C: "Como líder, exige qualidade e critério técnico, dá autonomia às pessoas competentes e é rigoroso(a) com padrões e prazos.",
};

const ESTILO_COMUNICACAO: PorLetra<string> = {
  D: "Comunica-se de forma direta e objetiva, às vezes soando confrontador(a) ao ir direto ao ponto.",
  I: "Comunica-se de forma expressiva e envolvente, usando histórias e entusiasmo para engajar quem ouve.",
  S: "Comunica-se de forma calma e ponderada, evitando confrontos desnecessários e ouvindo antes de responder.",
  C: "Comunica-se de forma precisa e formal, preferindo dados e argumentos concretos a apelos emocionais.",
};

const AMBIENTE_TRABALHO: PorLetra<string> = {
  D: "Prefere ambientes dinâmicos, com autonomia para agir e metas claras a perseguir.",
  I: "Prefere ambientes sociais, colaborativos, com espaço para interação e novidade.",
  S: "Prefere ambientes estáveis, previsíveis e com uma equipe cooperativa.",
  C: "Prefere ambientes organizados e estruturados, com processos claros e uma equipe competente.",
};

const DESEMPENHO_TAREFAS: PorLetra<string> = {
  D: "Entrega tarefas com rapidez e foco em resultado, priorizando o que gera mais impacto.",
  I: "Entrega tarefas com criatividade, mas pode precisar de apoio para manter constância nos detalhes.",
  S: "Entrega tarefas com constância e responsabilidade, cumprindo prazos combinados de forma confiável.",
  C: "Entrega tarefas com grande senso de responsabilidade e atenção aos detalhes, exigindo perfeição de si e dos outros.",
};

const ESTILO_VENDAS: PorLetra<string> = {
  D: "Como vendedor(a), é direto(a) e focado(a) em fechar negócio, mostrando segurança e ritmo na negociação.",
  I: "Como vendedor(a), constrói relacionamento com facilidade e usa entusiasmo para conquistar a confiança do cliente.",
  S: "Como vendedor(a), constrói confiança pela consistência e pelo cuidado pós-venda, priorizando relações de longo prazo.",
  C: "Como vendedor(a), demonstra conhecimento profundo do produto e usa uma abordagem lógica para convencer o cliente.",
};

// ---------------------------------------------------------------------------
// Compositores exportados — usados pelo motor de relatório
// ---------------------------------------------------------------------------

export function subCaracteristicas(p: DiscLetter, s: DiscLetter) {
  return composeList(SUBCARACTERISTICAS, p, s);
}
export function valorizaOutrosPor(p: DiscLetter, s: DiscLetter) {
  return composeList(VALORIZA_OUTROS_POR, p, s);
}
export function necessidadesBasicas(p: DiscLetter, s: DiscLetter) {
  return composeList(NECESSIDADES_BASICAS, p, s);
}
export function fatoresAfastamento(p: DiscLetter, s: DiscLetter) {
  return composeList(FATORES_AFASTAMENTO, p, s);
}

// Sugestões práticas para a devolutiva — curtas, ligadas ao fator primário,
// para que o relatório não seja só descritivo, mas também aponte um próximo
// passo concreto para a conversa entre gestor(a) e colaborador(a).
const SUGESTAO_DESENVOLVIMENTO: PorLetra<string> = {
  D: "Sugestão para a devolutiva: dar mais contexto antes de pedir decisões e reservar um momento para checar como as pessoas ao redor reagiram, já que o ritmo pode atropelar quem precisa de mais tempo.",
  I: "Sugestão para a devolutiva: ajudar a transformar entusiasmo em follow-through, com checkpoints simples de acompanhamento para os compromissos assumidos em conversas mais informais.",
  S: "Sugestão para a devolutiva: dar avisos antecipados sobre mudanças e criar espaço seguro para que discorde abertamente, já que a tendência a evitar conflito pode esconder problemas reais.",
  C: "Sugestão para a devolutiva: combinar previamente um prazo-limite para análise, para que o cuidado com detalhes não vire trava na tomada de decisão.",
};

const SUGESTAO_APROVEITAMENTO: PorLetra<string> = {
  D: "Vale aproveitar esse traço dando autonomia real em projetos com prazo apertado ou decisão sob incerteza.",
  I: "Vale aproveitar esse traço em papéis de porta-voz, negociação ou onboarding de novas pessoas no time.",
  S: "Vale aproveitar esse traço em funções que dependem de constância e confiança construída ao longo do tempo.",
  C: "Vale aproveitar esse traço em entregas onde o custo de um erro é alto e a qualidade técnica é o critério principal.",
};

export function habilidadesBasicas(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "demonstra habilidades básicas alinhadas", 0)} ${composeText(HABILIDADES_BASICAS, p, s, clareza)}`;
}
export function habilidadesComuns(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "manifesta, no dia a dia, características comuns", 1)} ${composeText(HABILIDADES_COMUNS, p, s, clareza)}`;
}
export function vantagens(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "tem como principal vantagem atuar", 2)} ${composeText(VANTAGENS, p, s, clareza)} ${SUGESTAO_APROVEITAMENTO[p]}`;
}
export function desvantagens(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "pode encontrar dificuldades ao atuar", 0)} ${composeText(DESVANTAGENS, p, s, clareza)} ${SUGESTAO_DESENVOLVIMENTO[p]}`;
}
export function fatoresMotivacionais(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "se motiva", 1)} ${composeText(FATORES_MOTIVACIONAIS, p, s, clareza)}`;
}
export function formaBuscaResultados(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "busca resultados", 0)} ${FORMA_BUSCA_RESULTADOS[p]}`;
}
export function organizacaoPlanejamento(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "se organiza e planeja", 2)} ${composeText(ORGANIZACAO_PLANEJAMENTO, p, s, clareza)}`;
}
export function reacaoPressao(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "reage sob pressão", 1)} ${REACAO_PRESSAO[p]} ${SUGESTAO_DESENVOLVIMENTO[p]}`;
}
export function relacaoMudancas(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "lida com mudanças", 2)} ${RELACAO_MUDANCAS[p]}`;
}
export function relacionamentos(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "constrói relacionamentos", 0)} ${composeText(RELACIONAMENTOS, p, s, clareza)}`;
}
export function relacionandoOutros(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "se relaciona com os outros no dia a dia", 0)} ${RELACIONANDO_OUTROS[p]}`;
}
export function tomandoDecisoes(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "toma decisões", 1)} ${TOMANDO_DECISOES[p]}`;
}
export function estiloGestaoRequerido(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "responde melhor a uma gestão pensada para quem atua", 1)} ${composeText(ESTILO_GESTAO_REQUERIDO, p, s, clareza)}`;
}
export function estiloLideranca(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "lidera", 2)} ${composeText(ESTILO_LIDERANCA, p, s, clareza)}`;
}
export function estiloComunicacao(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  const gapComunicacao = Math.round(Math.abs(ctx.othersPct[p] - ctx.selfPct[p]));
  const notaGap =
    gapComunicacao >= 12
      ? ` No fator ${FACTOR_NAME[p]}, há uma diferença de ${gapComunicacao} pontos entre como ${primeiroNome(ctx.nome)} se vê (${ctx.selfPct[p]}%) e como é percebida (${ctx.othersPct[p]}%) — vale conversar sobre isso na devolutiva.`
      : "";
  return `${abre(ctx, p, s, "se comunica", 0)} ${composeText(ESTILO_COMUNICACAO, p, s, clareza)}${notaGap}`;
}
export function ambienteTrabalho(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "rende melhor", 2)} ${AMBIENTE_TRABALHO[p]}`;
}
export function desempenhoTarefas(ctx: DiscCtx, p: DiscLetter) {
  return `${abreSimples(ctx, p, "entrega tarefas", 0)} ${DESEMPENHO_TAREFAS[p]}`;
}
export function estiloVendas(ctx: DiscCtx, p: DiscLetter, s: DiscLetter) {
  const clareza = clarezaPerfil(ctx.norm, p, s);
  return `${abre(ctx, p, s, "conduz vendas", 1)} ${composeText(ESTILO_VENDAS, p, s, clareza)}`;
}

// ---------------------------------------------------------------------------
// Competências (gráfico de 20 competências) — cada uma é uma combinação
// ponderada dos quatro fatores D/I/S/C (0-100), com peso relativo somando 1.
// ---------------------------------------------------------------------------

export interface CompetenciaDef {
  nome: string;
  descricao: string;
  pesos: PorLetra<number>;
  base: number;
}

// Pesos fundamentados em duas fontes: (1) o eixo circumplex clássico do DISC
// (Marston), onde D+I formam o polo ativo/rápido e S+C o polo ponderado, e
// D+C formam o polo de tarefa/questionamento e I+S o de pessoas/aceitação;
// e (2) a direção das correlações entre D/I/S/C e o modelo Big Five
// encontradas em estudo comparativo (123test, "DISC vs Big Five"): D ligado
// a mais Extroversão e MENOS Amabilidade; I a mais Extroversão e menos
// Neuroticismo; S a menos Extroversão e mais Amabilidade; C a menos
// Extroversão e mais Neuroticismo. Por isso, diferente da primeira versão,
// alguns pesos aqui são negativos (ex.: D reduz Empatia e Capacidade de
// ouvir, por causa da associação com menor Amabilidade).
export const COMPETENCIAS: CompetenciaDef[] = [
  { nome: "Tolerância", descricao: "Capacidade de tolerar diferentes maneiras de pensar, agir e sentir, mesmo sendo opostas às adotadas por si mesmo.", pesos: { D: 0, I: 0.2, S: 0.45, C: -0.1 }, base: 35 },
  { nome: "Planejamento", descricao: "Capacidade de planejar as ações, processos e atividades.", pesos: { D: 0, I: 0, S: 0.2, C: 0.55 }, base: 20 },
  { nome: "Empatia", descricao: "Capacidade de compreender o sentimento ou reação da outra pessoa imaginando-se nas mesmas circunstâncias.", pesos: { D: -0.1, I: 0.3, S: 0.4, C: 0 }, base: 30 },
  { nome: "Capacidade de ouvir", descricao: "Capacidade de escuta ativa, habilidade de ouvir com atenção.", pesos: { D: -0.15, I: 0, S: 0.5, C: 0.2 }, base: 30 },
  { nome: "Concentração", descricao: "Nível de capacidade/necessidade de concentração para execução de um trabalho que exige atenção e constância.", pesos: { D: -0.1, I: -0.1, S: 0.2, C: 0.55 }, base: 30 },
  { nome: "Condescendência", descricao: "Indica o quanto a pessoa considera e pondera as intenções, desejos e opinião de outrem, agindo com complacência para buscar a melhor ação possível.", pesos: { D: -0.2, I: 0.15, S: 0.5, C: 0 }, base: 30 },
  { nome: "Perfil Técnico", descricao: "Aptidão para habilidades técnicas. Indica a capacidade da pessoa se \"tecnificar\", dar ou proporcionar recursos técnicos a uma atividade para otimizá-la.", pesos: { D: 0, I: 0, S: 0, C: 0.7 }, base: 15 },
  { nome: "Organização", descricao: "Capacidade de organizar as ideias de maneira clara e bem definida.", pesos: { D: 0, I: 0, S: 0.15, C: 0.6 }, base: 15 },
  { nome: "Detalhismo", descricao: "Capacidade de exposição minuciosa de fatos, planos ou projetos, com atenção a detalhes.", pesos: { D: 0, I: 0, S: 0, C: 0.7 }, base: 15 },
  { nome: "Rigorosidade", descricao: "Competência de uma pessoa exata, precisa, exigente e de raciocínio rigoroso.", pesos: { D: 0.2, I: 0, S: 0, C: 0.55 }, base: 15 },
  { nome: "Orientado por resultado", descricao: "Identifica o quanto a pessoa se desenvolve pelo trabalho e pela ação, investindo mais tempo na execução das tarefas.", pesos: { D: 0.65, I: 0, S: 0, C: 0.1 }, base: 15 },
  { nome: "Multitarefas", descricao: "Capacidade de executar várias tarefas ao mesmo tempo.", pesos: { D: 0.3, I: 0.35, S: 0, C: 0 }, base: 25 },
  { nome: "Automotivação", descricao: "Indica o nível da capacidade de a pessoa se automotivar, a capacidade de motivar-se ao entusiasmo.", pesos: { D: 0.4, I: 0.25, S: 0, C: 0 }, base: 25 },
  { nome: "Proatividade", descricao: "Indica a capacidade de agir antecipadamente, resolvendo situações e problemas futuros sem que seja obrigatoriamente requerido.", pesos: { D: 0.45, I: 0.25, S: 0, C: 0 }, base: 20 },
  { nome: "Dinamismo", descricao: "Característica de quem demonstra energia, movimento e vitalidade, lida bem com mudanças e ambientes dinâmicos.", pesos: { D: 0.25, I: 0.45, S: 0, C: 0 }, base: 20 },
  { nome: "Dominância", descricao: "Competência de quem exerce uma postura dominante, firme. Normalmente toma decisões rápidas por ser menos avesso a risco e assume uma postura de comando.", pesos: { D: 0.8, I: 0, S: 0, C: 0 }, base: 10 },
  { nome: "Extroversão", descricao: "Característica de quem é extrovertido, expansivo, comunicativo e sociável.", pesos: { D: 0, I: 0.85, S: 0, C: 0 }, base: 8 },
  { nome: "Relacionamento interpessoal", descricao: "Capacidade de estabelecer conexões ou vínculos com outras pessoas dentro de um determinado contexto.", pesos: { D: -0.1, I: 0.4, S: 0.35, C: 0 }, base: 25 },
  { nome: "Sociabilidade", descricao: "Indica a necessidade e a tendência à busca por relacionamento social com as outras pessoas, de forma expansiva e extrovertida.", pesos: { D: 0, I: 0.75, S: 0, C: 0 }, base: 15 },
  { nome: "Orientado por relacionamento", descricao: "O nível de foco da pessoa em relacionamentos. Indica o quanto a pessoa se desenvolve por relacionamentos e os prioriza em suas tarefas.", pesos: { D: -0.05, I: 0.45, S: 0.3, C: 0 }, base: 25 },
];

// ---------------------------------------------------------------------------
// Área de talentos (13 arquétipos profissionais) — cada um definido por um
// perfil DISC ideal aproximado; a pontuação usa a mesma lógica de aderência
// já usada para comparar colaborador x cargo (distância euclidiana invertida).
// ---------------------------------------------------------------------------

export interface TalentoDef {
  nome: string;
  descricao: string;
  ideal: PorLetra<number>;
}

export const AREA_TALENTOS: TalentoDef[] = [
  { nome: "Comandante", descricao: "Empreendedor(a), independente, exigente consigo mesmo(a) e com os outros. Bom(oa) iniciador(a) de negócios e resolvedor(a) de problemas, com pulso firme no comando de equipes.", ideal: { D: 90, I: 40, S: 20, C: 30 } },
  { nome: "Competidor", descricao: "Alimenta-se de vitórias e busca se sair vitorioso(a) a cada disputa. Tem pulso e garra, gosta de competir e de metas claras.", ideal: { D: 80, I: 65, S: 20, C: 35 } },
  { nome: "Administrador", descricao: "Tem habilidade para gerenciar sistemas e pessoas. É orientado(a) a resultados, rápido(a) e intenso(a), com iniciativa para resolver problemas e desafios.", ideal: { D: 65, I: 55, S: 30, C: 60 } },
  { nome: "Motivador", descricao: "Dá vida ao que fala, é bom(oa) palestrante, motivador(a) e vendedor(a). Tem habilidade para ajudar pessoas a se desenvolverem no trabalho.", ideal: { D: 35, I: 90, S: 45, C: 20 } },
  { nome: "Vendedor", descricao: "Vende ideias, benefícios e prestígio. É independente, tem senso de urgência e vende bem produtos tangíveis ou intangíveis.", ideal: { D: 55, I: 80, S: 30, C: 25 } },
  { nome: "Diplomata", descricao: "Tem habilidade para solucionar conflitos, é bom(oa) ouvinte e se comunica bem. Sabe passar conhecimento e negociar.", ideal: { D: 30, I: 75, S: 55, C: 45 } },
  { nome: "Aconselhador", descricao: "Bom(oa) ouvinte e voltado(a) a interesses sociais. Agradável, trabalha bem em equipe e gosta de orientar e ajudar as pessoas.", ideal: { D: 20, I: 60, S: 80, C: 40 } },
  { nome: "Atendente", descricao: "Também conhecido(a) como Protetor(a), gosta de trabalhar com relacionamentos positivos e uma equipe onde os membros se ajudam mutuamente.", ideal: { D: 15, I: 45, S: 85, C: 35 } },
  { nome: "Professoral", descricao: "Bom(oa) professor(a) e instrutor(a). Trabalha bem com suporte técnico ou funções que demandam conhecimento técnico e transmissão de conhecimento.", ideal: { D: 25, I: 55, S: 70, C: 60 } },
  { nome: "Técnico", descricao: "Autodidata, consegue realizar praticamente tudo o que se propõe a fazer. É especialista, lida bem com números, tabelas e gráficos.", ideal: { D: 20, I: 25, S: 55, C: 80 } },
  { nome: "Especialista", descricao: "Controla o trabalho de acordo com as regras. Realiza muito bem tarefas que exigem regras e treinamento, com precisão e método.", ideal: { D: 25, I: 20, S: 45, C: 85 } },
  { nome: "Estrategista", descricao: "Inventor(a) e organizador(a), executa bons trabalhos técnicos e analíticos. Tem habilidade em trabalhos sistematizados, fiscais e estatísticos.", ideal: { D: 55, I: 25, S: 35, C: 80 } },
  { nome: "Controlador", descricao: "Rápido(a) e eficiente, exigente consigo mesmo(a) e com os outros. Tem alto padrão de desempenho e é disciplinado(a), com bom equilíbrio entre velocidade e qualidade.", ideal: { D: 60, I: 20, S: 40, C: 75 } },
];

// ---------------------------------------------------------------------------
// Comparação com cargo de mercado — pedido da Carolina: um campo livre para
// digitar o cargo (atual ou pretendido) e ver se o perfil está aderente às
// exigências típicas daquela função. Como não existe uma base de dados de
// mercado em tempo real, isto é uma referência curada com base em práticas
// gerais de RH e recrutamento comportamental (perfis DISC amplamente
// associados a cada função) — não é um levantamento estatístico do mercado
// real, e deve ser lido como ponto de partida para a devolutiva, não como
// veredito definitivo. Quando o cargo já está cadastrado no sistema (com
// disc_ideal_d/i/s/c configurado pelo RH), aquela comparação continua sendo
// a mais confiável — esta é um complemento para quando não há um cargo
// cadastrado ou para comparar hipóteses de recolocação.
// ---------------------------------------------------------------------------

export interface CargoMercadoDef {
  nome: string;
  aliases: string[];
  ideal: PorLetra<number>;
  exigencias: string;
}

export const CARGOS_MERCADO: CargoMercadoDef[] = [
  { nome: "Vendedor(a) / Consultor(a) de Vendas", aliases: ["vendedor", "vendedora", "vendas", "consultor de vendas", "representante comercial", "sdr", "closer"], ideal: { D: 55, I: 75, S: 25, C: 25 }, exigencias: "ritmo rápido de prospecção, tolerância a rejeição, comunicação persuasiva e orientação a metas — o mercado espera Influência alta com Dominância moderada." },
  { nome: "Atendimento ao Cliente / SAC", aliases: ["atendimento", "sac", "atendente", "suporte ao cliente", "customer service", "call center"], ideal: { D: 20, I: 55, S: 65, C: 30 }, exigencias: "paciência, escuta ativa e tom cordial mesmo sob reclamação — Estabilidade e Influência altas costumam sustentar melhor esse ritmo." },
  { nome: "Analista Financeiro / Contábil", aliases: ["financeiro", "contabil", "contábil", "contador", "analista financeiro", "controladoria", "fiscal"], ideal: { D: 25, I: 15, S: 40, C: 85 }, exigencias: "precisão numérica, conformidade regulatória e baixa tolerância a erro — Conformidade muito alta é o fator mais determinante para o mercado nessa função." },
  { nome: "Desenvolvedor(a) de Software / TI", aliases: ["desenvolvedor", "programador", "dev", "engenheiro de software", "ti", "tecnologia da informação", "analista de sistemas"], ideal: { D: 25, I: 20, S: 45, C: 75 }, exigencias: "concentração prolongada, raciocínio lógico e atenção a detalhes técnicos — Conformidade alta com Estabilidade moderada para sustentar tarefas longas." },
  { nome: "Gerente / Coordenador(a)", aliases: ["gerente", "coordenador", "coordenadora", "gestor", "gestora", "supervisor", "supervisora"], ideal: { D: 65, I: 50, S: 35, C: 55 }, exigencias: "equilíbrio entre tomada de decisão (D), comunicação com o time (I) e disciplina de processos (C) — perfil sem nenhum fator extremamente baixo costuma se sair melhor." },
  { nome: "Recursos Humanos / RH", aliases: ["rh", "recursos humanos", "recrutamento", "dp", "departamento pessoal", "people"], ideal: { D: 30, I: 65, S: 55, C: 45 }, exigencias: "relação interpessoal constante, mediação de conflitos e sigilo — Influência e Estabilidade altas, com Conformidade suficiente para lidar com processos e legislação trabalhista." },
  { nome: "Recepcionista / Secretariado", aliases: ["recepcionista", "secretaria", "secretário", "secretária", "auxiliar administrativo"], ideal: { D: 20, I: 55, S: 60, C: 40 }, exigencias: "cordialidade constante no primeiro contato e organização de agenda — Influência e Estabilidade acima da média, Dominância baixa." },
  { nome: "Advogado(a) / Jurídico", aliases: ["advogado", "advogada", "juridico", "jurídico"], ideal: { D: 55, I: 35, S: 30, C: 70 }, exigencias: "argumentação assertiva (D) aliada a rigor técnico-normativo (C) — o mercado tende a valorizar Conformidade alta com alguma Dominância para sustentar posições." },
  { nome: "Motorista / Logística / Operações", aliases: ["motorista", "logistica", "logística", "operacional", "almoxarifado", "estoque"], ideal: { D: 30, I: 20, S: 65, C: 55 }, exigencias: "rotina, cumprimento de prazos e regras de segurança — Estabilidade e Conformidade altas, com Influência baixa." },
  { nome: "Marketing / Comunicação", aliases: ["marketing", "comunicação", "comunicacao", "publicidade", "redes sociais", "social media"], ideal: { D: 45, I: 75, S: 30, C: 35 }, exigencias: "criatividade, comunicação persuasiva e velocidade de resposta a tendências — Influência é o fator dominante esperado pelo mercado." },
  { nome: "Engenheiro(a)", aliases: ["engenheiro", "engenheira", "engenharia"], ideal: { D: 50, I: 25, S: 35, C: 70 }, exigencias: "rigor técnico e responsabilidade sobre normas — Conformidade alta, com Dominância moderada para liderar decisões de projeto." },
  { nome: "Professor(a) / Instrutor(a)", aliases: ["professor", "professora", "instrutor", "educador", "docente"], ideal: { D: 30, I: 65, S: 50, C: 45 }, exigencias: "comunicação didática constante e paciência com ritmos diferentes de aprendizagem — Influência alta com Estabilidade moderada." },
  { nome: "Enfermagem / Saúde", aliases: ["enfermeiro", "enfermeira", "enfermagem", "tecnico de enfermagem", "técnico de enfermagem", "cuidador"], ideal: { D: 30, I: 35, S: 60, C: 60 }, exigencias: "precisão em protocolos (C) combinada com acolhimento ao paciente (S) — mercado da saúde valoriza esse equilíbrio, com Dominância mais baixa." },
  { nome: "Diretor(a) / Executivo(a) (C-level)", aliases: ["diretor", "diretora", "ceo", "executivo", "c-level", "presidente"], ideal: { D: 80, I: 55, S: 25, C: 45 }, exigencias: "decisões de alto impacto, tolerância a risco e comunicação de visão estratégica — Dominância muito alta é o fator mais determinante nesse nível." },
  { nome: "Recrutador(a) / Talent Acquisition", aliases: ["recrutador", "recrutadora", "talent acquisition", "selecao", "seleção"], ideal: { D: 35, I: 70, S: 45, C: 40 }, exigencias: "networking constante e avaliação rápida de pessoas — Influência alta, com Dominância moderada para conduzir processos seletivos com firmeza." },
  { nome: "Produção / Fábrica / Chão de fábrica", aliases: ["producao", "produção", "fabrica", "fábrica", "operador de maquina", "operador de máquina", "industria", "indústria"], ideal: { D: 30, I: 20, S: 60, C: 60 }, exigencias: "repetição de processos com segurança e qualidade constantes — Estabilidade e Conformidade altas, Influência baixa." },
  { nome: "Designer / Criação / UX", aliases: ["designer", "design", "criação", "criacao", "ux", "ui"], ideal: { D: 35, I: 55, S: 35, C: 55 }, exigencias: "equilíbrio entre criatividade expressiva (I) e rigor visual/técnico (C) — nenhum fator costuma ser extremo nesse perfil." },
];

// ---------------------------------------------------------------------------
// Análise Comportamental Detalhada (pedido da Carolina em 28/08/2026) — seção
// ADICIONAL ao relatório já existente, apensada ao final. Continua sendo
// geração de texto baseada em regras (banco de frases + composição pelos
// dados reais desta avaliação), igual ao restante do arquivo — não é uma
// chamada a um modelo de IA/LLM real, por isso o rótulo usado na UI é
// "Análise Comportamental Detalhada", nunca "Análise via IA".
// ---------------------------------------------------------------------------

/** Igual a `composeList`, mas retorna uma lista mais ampla (até 5 itens: os 3
 * do fator primário + até 2 do secundário) — usada nas listas de Forças e
 * Pontos de Atenção, que pedem de 4 a 6 itens. */
function composeListAmpla(bank: PorLetra<string[]>, primary: DiscLetter, secondary: DiscLetter) {
  const items = [...bank[primary], ...bank[secondary].slice(0, 2)];
  return Array.from(new Set(items));
}

const FORCAS_BULLETS: PorLetra<string[]> = {
  D: [
    "Toma decisões rápidas e assume a responsabilidade pelos resultados.",
    "Não se intimida diante de obstáculos ou de conflitos quando é preciso defender um ponto.",
    "Tem senso de urgência para tirar projetos do papel.",
  ],
  I: [
    "Comunica ideias de forma envolvente e contagia o ambiente ao redor.",
    "Constrói relacionamentos novos com facilidade.",
    "Motiva o time em torno de um objetivo comum.",
  ],
  S: [
    "Mantém constância e cumpre o que promete.",
    "É um ponto de estabilidade e confiança para o time.",
    "Ouve bem antes de agir e evita decisões precipitadas.",
  ],
  C: [
    "Mantém padrão elevado de qualidade e atenção aos detalhes.",
    "Identifica riscos e inconsistências antes dos demais.",
    "Traz rigor técnico às entregas.",
  ],
};

const PONTOS_ATENCAO_BULLETS: PorLetra<string[]> = {
  D: [
    "Pode parecer impaciente com quem precisa de mais tempo para decidir.",
    "Tende a priorizar o resultado em detrimento do processo.",
    "Pode ouvir menos do que o ideal antes de decidir sozinho(a).",
  ],
  I: [
    "Pode perder o foco em detalhes e prazos ao se envolver demais com a conversa.",
    "Pode assumir compromissos maiores do que consegue sustentar no ritmo do entusiasmo.",
    "Pode evitar conversas difíceis para preservar o clima do time.",
  ],
  S: [
    "Pode demorar para se posicionar diante de mudanças.",
    "Pode evitar conflitos necessários por priorizar a harmonia.",
    "Pode perder energia e disposição sob pressão constante.",
  ],
  C: [
    "Pode travar decisões à espera de mais informação do que o necessário.",
    "Pode ser excessivamente crítico(a) consigo e com os outros.",
    "Pode resistir a mudanças que não venham acompanhadas de dados que as justifiquem.",
  ],
};

/** Resumo curto combinando arquétipo primário + secundário, a clareza do
 * perfil e (quando existir) a aderência ao cargo avaliado — para abrir a
 * seção "Análise Comportamental Detalhada" com os números reais desta
 * avaliação, não um texto genérico. */
export function sumarioExecutivo(
  ctx: DiscCtx,
  primary: DiscLetter,
  secondary: DiscLetter,
  compatibilidadeCargo?: number | null
) {
  const nome = primeiroNome(ctx.nome);
  const clareza = clarezaPerfil(ctx.norm, primary, secondary);
  const clarezaTexto =
    clareza === "definido"
      ? `um perfil bem definido, com o estilo ${ARCHETYPE_NAME[primary]} claramente à frente dos demais`
      : clareza === "moderado"
      ? `um perfil predominante em ${ARCHETYPE_NAME[primary]}, com traços relevantes de ${ARCHETYPE_NAME[secondary]}`
      : `um perfil combinado, com os estilos ${ARCHETYPE_NAME[primary]} e ${ARCHETYPE_NAME[secondary]} bem próximos entre si`;
  let texto = `${nome} apresenta, nesta avaliação, ${clarezaTexto} — resultando no perfil ${nomePerfil(primary, secondary)}.`;
  if (compatibilidadeCargo != null) {
    texto += ` Em relação ao cargo comparado neste relatório, a aderência calculada é de ${compatibilidadeCargo}%.`;
  }
  return texto;
}

/** 2-3 parágrafos de retrato comportamental, na mesma lógica de composição
 * (abre/abreSimples + banco de frases) já usada no restante do relatório —
 * redação própria deste sistema, não copiada de nenhum material de terceiros. */
export function retratoComportamental(ctx: DiscCtx, primary: DiscLetter, secondary: DiscLetter): string[] {
  const clareza = clarezaPerfil(ctx.norm, primary, secondary);
  const paragrafo1 = `${abre(ctx, primary, secondary, "se apresenta no ambiente de trabalho", 2)} ${composeText(
    HABILIDADES_COMUNS,
    primary,
    secondary,
    clareza
  )}`;
  const paragrafo2 = `${composeText(VANTAGENS, primary, secondary, clareza)} ${composeText(DESVANTAGENS, primary, secondary, clareza)}`;
  const paragrafo3 = `${abreSimples(ctx, primary, "toma decisões e lida com o dia a dia", 2)} ${TOMANDO_DECISOES[primary]} ${
    RELACAO_MUDANCAS[primary]
  }`;
  return [paragrafo1, paragrafo2, paragrafo3];
}

/** Forças e pontos de atenção — 4 a 6 itens cada, adaptados dos bancos de
 * vantagens/desvantagens já existentes no arquivo, compostos pelo par
 * primário/secundário real desta avaliação. */
export function forcasEPontosAtencao(ctx: DiscCtx, primary: DiscLetter, secondary: DiscLetter) {
  return {
    forcas: composeListAmpla(FORCAS_BULLETS, primary, secondary),
    pontosAtencao: composeListAmpla(PONTOS_ATENCAO_BULLETS, primary, secondary),
  };
}

export interface ComparacaoPercepcaoItem {
  fator: DiscLetter;
  nome: string;
  comoSeVe: number;
  comoOsOutrosVeem: number;
  delta: number;
}

/** 4-5 perguntas abertas para a devolutiva/entrevista, derivadas do padrão de
 * fatores desta pessoa (não hardcoded para um perfil específico): citam o
 * fator primário e secundário, a maior divergência de percepção e o fator
 * menos presente no perfil atual. */
export function perguntasEntrevista(
  ctx: DiscCtx,
  primary: DiscLetter,
  secondary: DiscLetter,
  comparacaoPercepcao: ComparacaoPercepcaoItem[]
): string[] {
  const letras: DiscLetter[] = ["D", "I", "S", "C"];
  const maiorGap = comparacaoPercepcao.reduce((max, f) => (Math.abs(f.delta) > Math.abs(max.delta) ? f : max), comparacaoPercepcao[0]);
  const fatorMaisFraco = letras.reduce((min, f) => (ctx.norm[f] < ctx.norm[min] ? f : min), letras[0]);

  return [
    `Conte sobre uma situação recente em que seu lado ${ARCHETYPE_NAME[primary]} ajudou você a resolver um problema no trabalho.`,
    `Em que momentos o traço ${ARCHETYPE_NAME[secondary]} aparece mais no seu dia a dia — e quando ele fica em segundo plano?`,
    Math.abs(maiorGap.delta) >= 1
      ? `Em ${maiorGap.nome}, as pessoas ao seu redor tendem a te perceber ${
          maiorGap.delta > 0 ? "mais" : "menos"
        } do que você mesmo(a) se percebe (${maiorGap.comoSeVe}% x ${maiorGap.comoOsOutrosVeem}%). O que você acha que explica essa diferença?`
      : `Como você diria que as pessoas ao seu redor percebem seu comportamento no dia a dia, comparado a como você mesmo(a) se vê?`,
    `${FACTOR_NAME[fatorMaisFraco]} é o fator menos presente no seu perfil atual. Em que situações isso já foi um desafio para você no trabalho?`,
    `Descreva como você costuma reagir quando está sob pressão ou diante de um prazo apertado.`,
  ];
}

function normalizarTexto(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Busca por texto livre (com ou sem acento) entre os cargos de referência. */
export function encontrarCargoMercado(cargoDigitado: string): CargoMercadoDef | null {
  const alvo = normalizarTexto(cargoDigitado);
  if (!alvo) return null;
  for (const c of CARGOS_MERCADO) {
    const nomeNorm = normalizarTexto(c.nome);
    if (alvo.includes(nomeNorm) || nomeNorm.includes(alvo)) return c;
    for (const a of c.aliases) {
      const aliasNorm = normalizarTexto(a);
      if (alvo.includes(aliasNorm) || aliasNorm.includes(alvo)) return c;
    }
  }
  return null;
}

export interface ComparacaoCargoMercado {
  aderencia: number;
  veredito: string;
  fatoresAlinhados: DiscLetter[];
  fatoresDivergentes: DiscLetter[];
}

/** Mesma lógica de distância euclidiana já usada para cargo x colaborador,
 * aplicada ao perfil de referência de mercado. */
export function compararCargoMercado(norm: PorLetra<number>, cargo: CargoMercadoDef): ComparacaoCargoMercado {
  const letras: DiscLetter[] = ["D", "I", "S", "C"];
  let sumSq = 0;
  const fatoresAlinhados: DiscLetter[] = [];
  const fatoresDivergentes: DiscLetter[] = [];
  letras.forEach((f) => {
    const d = norm[f] - cargo.ideal[f];
    sumSq += d * d;
    if (Math.abs(d) <= 15) fatoresAlinhados.push(f);
    else fatoresDivergentes.push(f);
  });
  const dist = Math.sqrt(sumSq);
  const aderencia = Math.max(0, Math.round(100 - (dist / 200) * 100));
  const veredito =
    aderencia >= 75
      ? "Alta aderência ao cargo"
      : aderencia >= 55
      ? "Aderência moderada ao cargo"
      : aderencia >= 35
      ? "Aderência baixa ao cargo"
      : "Perfil bem diferente do esperado para o cargo";
  return { aderencia, veredito, fatoresAlinhados, fatoresDivergentes };
}
