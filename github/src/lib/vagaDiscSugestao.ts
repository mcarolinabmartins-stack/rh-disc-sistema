// Sugestão de perfil DISC ideal para uma vaga.
//
// IMPORTANTE — isto NÃO é uma avaliação gerada por IA. Não existe nenhuma
// chamada a API externa aqui. É um casamento heurístico de texto (título +
// atividades + requisitos da vaga) contra a base curada CARGOS_MERCADO já
// usada no relatório DISC individual (src/lib/discReportContent.ts), usando
// a mesma função de busca por palavra-chave/alias (encontrarCargoMercado).
//
// O resultado é sempre um PRÉ-PREENCHIMENTO EDITÁVEL: a Carolina (ou quem
// estiver publicando a vaga) pode e deve ajustar os sliders de D/I/S/C antes
// de publicar. Nunca deve ser tratado como um veredito travado — é só um
// ponto de partida para acelerar o cadastro da vaga.
import { CARGOS_MERCADO, encontrarCargoMercado } from "@/lib/discReportContent";

export interface SugestaoDiscVaga {
  d: number;
  i: number;
  s: number;
  c: number;
  cargoReferencia: string | null;
  aderenciaTexto: string;
}

// Perfil neutro/equilibrado usado quando nenhum cargo de referência é
// reconhecido no texto — não favorece nenhum dos quatro fatores.
const PERFIL_NEUTRO = { d: 25, i: 25, s: 25, c: 25 };

/**
 * Sugere um perfil DISC ideal para a vaga a partir do título, das atividades
 * descritas e dos requisitos, buscando o cargo de referência mais próximo em
 * CARGOS_MERCADO (heurística de texto — ver encontrarCargoMercado). Quando
 * nenhum cargo é reconhecido, devolve um perfil neutro (25/25/25/25) com uma
 * mensagem explicando que é preciso ajustar manualmente.
 */
export function sugerirDiscIdealParaVaga(
  titulo: string,
  descricaoAtividades: string,
  requisitos: string
): SugestaoDiscVaga {
  const textoCompleto = [titulo, descricaoAtividades, requisitos].filter(Boolean).join(" ");

  // Tenta primeiro pelo título isolado (mais preciso quando o título já é um
  // nome de cargo comum, ex.: "Analista Financeiro"), depois pelo texto
  // completo (título + atividades + requisitos), para pegar casos em que o
  // título é genérico mas a descrição deixa clara a função (ex.: título
  // "Vaga #42" com atividades de "prospecção e fechamento de vendas").
  const cargo = encontrarCargoMercado(titulo) ?? encontrarCargoMercado(textoCompleto);

  if (!cargo) {
    return {
      ...PERFIL_NEUTRO,
      cargoReferencia: null,
      aderenciaTexto:
        "Não foi possível identificar um cargo de referência a partir do título/descrição digitados. " +
        "Sugerimos um perfil neutro (25/25/25/25) — ajuste manualmente os sliders com base no que a vaga realmente exige.",
    };
  }

  return {
    d: cargo.ideal.D,
    i: cargo.ideal.I,
    s: cargo.ideal.S,
    c: cargo.ideal.C,
    cargoReferencia: cargo.nome,
    aderenciaTexto:
      `Sugestão baseada no cargo de referência "${cargo.nome}" (base interna curada, não é IA nem levantamento de mercado em tempo real): ${cargo.exigencias} ` +
      "Revise e ajuste os sliders antes de publicar a vaga — esta é só uma sugestão inicial.",
  };
}

// Reexportado por conveniência para quem quiser listar os cargos de
// referência disponíveis (ex.: um autocomplete futuro no formulário de vaga).
export { CARGOS_MERCADO };
