export type Role = "rh" | "gestor" | "admin_master";
export type Nivel = "junior" | "pleno" | "senior" | "especialista" | "lideranca";
export type DiscLetter = "D" | "I" | "S" | "C";
export type MotivoHistorico = "admissao" | "reajuste" | "promocao" | "equiparacao" | "ajuste";
export type RegimeContratacao = "CLT" | "PJ";
export type TipoEventoRH = "ferias" | "falta" | "atestado" | "atraso" | "banco_horas" | "ida_medico";
export type TipoPesquisa = "clima" | "enps";
export type StatusVaga = "rascunho" | "aberta" | "pausada" | "encerrada";
export type PapelEmpresa = "rh" | "gestor";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface EmpresaConfig {
  id: number;
  nome_empresa: string;
  ramo_atuacao: string;
  updated_at: string;
}

// Empresa-cliente cadastrada pelo admin_master (multiempresa). Não confundir
// com EmpresaConfig acima, que é uma configuração global legada (ramo de
// atuação usado no benchmark salarial), mantida como está.
export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
}

export interface GrupoEmpresas {
  id: string;
  nome: string;
  created_at: string;
  // relations (joined, opcional)
  empresas?: Empresa[];
}

export interface UsuarioEmpresa {
  id: string;
  user_id: string;
  empresa_id: string;
  papel: PapelEmpresa;
  created_at: string;
  // relations (joined, opcional)
  empresa?: Empresa | null;
  profile?: Profile | null;
}

export interface UsuarioGrupo {
  user_id: string;
  grupo_id: string;
  created_at: string;
  grupo?: GrupoEmpresas | null;
}

export interface Cargo {
  id: string;
  titulo: string;
  area: string;
  nivel: Nivel;
  descricao: string;
  disc_ideal_d: number;
  disc_ideal_i: number;
  disc_ideal_s: number;
  disc_ideal_c: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  empresa_id?: string | null;
}

export interface FaixaSalarial {
  id: string;
  cargo_id: string;
  salario_min: number;
  salario_medio: number;
  salario_max: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacoes: string;
  created_at: string;
  empresa_id?: string | null;
}

export interface BenchmarkMercado {
  id: string;
  cargo_id: string;
  estado: string;
  ramo_atuacao: string;
  regime_contratacao: RegimeContratacao;
  salario_min: number;
  salario_medio: number;
  salario_max: number;
  fonte: string;
  data_referencia: string;
  created_at: string;
  empresa_id?: string | null;
}

export interface Colaborador {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cargo_id: string | null;
  gestor_id: string | null;
  setor: string;
  estado: string;
  cidade: string;
  data_admissao: string;
  salario_atual: number;
  regime_contratacao: RegimeContratacao;
  nivel: Nivel;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  empresa_id?: string | null;
  // desligamento
  data_desligamento?: string | null;
  motivo_desligamento?: string | null;
  custo_contratacao?: number | null;
  // relations (joined)
  cargo?: Cargo | null;
  gestor?: Profile | null;
}

export interface HistoricoSalarial {
  id: string;
  colaborador_id: string;
  cargo_id: string | null;
  nivel: Nivel;
  salario: number;
  regime_contratacao: RegimeContratacao;
  motivo: MotivoHistorico;
  data_alteracao: string;
  registrado_por: string | null;
  created_at: string;
}

export interface EventoRH {
  id: string;
  colaborador_id: string;
  tipo: TipoEventoRH;
  data_inicio: string;
  data_fim: string | null;
  horas: number | null;
  dias: number | null;
  observacoes: string;
  registrado_por: string | null;
  created_at: string;
  empresa_id?: string | null;
  // relations (joined)
  colaborador?: Colaborador | null;
}

export interface TreinamentoRH {
  id: string;
  colaborador_id: string | null; // null = treinamento geral da empresa
  nome_treinamento: string;
  custo: number;
  carga_horaria: number | null;
  data: string;
  observacoes: string;
  created_at: string;
  empresa_id?: string | null;
  colaborador?: Colaborador | null;
}

export interface PesquisaRodada {
  id: string;
  tipo: TipoPesquisa;
  rotulo: string;
  pergunta_principal: string;
  data_abertura: string;
  data_fechamento: string | null;
  ativo: boolean;
  created_at: string;
  empresa_id?: string | null;
}

export interface PesquisaResposta {
  id: string;
  rodada_id: string;
  respostas: { nota?: number; scores?: Record<string, number>; comentario?: string };
  created_at: string;
}

export interface AvaliacaoDisc {
  id: string;
  colaborador_id: string;
  data_aplicacao: string;
  score_d: number;
  score_i: number;
  score_s: number;
  score_c: number;
  perfil_primario: DiscLetter;
  perfil_secundario: DiscLetter;
  compatibilidade_cargo: number | null;
  respostas: unknown;
  aplicado_por: string | null;
  created_at: string;
}

export interface Vaga {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao_atividades: string;
  requisitos: string;
  salario: string;
  beneficios: string;
  disc_ideal_d: number;
  disc_ideal_i: number;
  disc_ideal_s: number;
  disc_ideal_c: number;
  status: StatusVaga;
  token_candidatura: string;
  token_preenchimento: string;
  created_by: string | null;
  created_at: string;
  // relations (joined, opcional)
  candidatos?: Candidato[];
}

export interface Candidato {
  id: string;
  vaga_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  curriculo_path: string | null;
  disc_norm: Record<DiscLetter, number> | null;
  disc_self_pct: Record<DiscLetter, number> | null;
  disc_others_pct: Record<DiscLetter, number> | null;
  respostas: unknown;
  compatibilidade_percentual: number | null;
  created_at: string;
}
