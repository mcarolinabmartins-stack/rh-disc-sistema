export type Role = "rh" | "gestor";
export type Nivel = "junior" | "pleno" | "senior" | "especialista" | "lideranca";
export type DiscLetter = "D" | "I" | "S" | "C";
export type MotivoHistorico = "admissao" | "reajuste" | "promocao" | "equiparacao" | "ajuste";
export type RegimeContratacao = "CLT" | "PJ";

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
}

export interface Colaborador {
  id: string;
  nome: string;
  email: string;
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
