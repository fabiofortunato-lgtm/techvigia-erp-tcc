export interface Condominio {
  id: string;
  nome: string;
  cnpj?: string | null;
  cpf?: string | null;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  sindico?: string | null;
  zelador?: string | null;
  periodicidade: number;
  createdAt: string;
  equipamentos?: Equipamento[];
  tecnicos?: { tecnico: { id: string; nome: string }; responsavelPrincipal: boolean }[];
  _count?: { equipamentos: number };
}

export type StatusEquipamento = 'OK' | 'DEFEITO';

export interface Equipamento {
  id: string;
  condominioId: string;
  condominio?: { id: string; nome: string }; // presente na listagem geral (GET /equipamentos)
  tipo: string;
  local?: string | null;
  status: StatusEquipamento;
  fabricante: string;
  modelo: string;
  numeroSerie?: string | null;
  patrimonio?: string | null;
  dataInstalacao: string;
  garantiaAte?: string | null;
  fotoUrl?: string | null;
  intervaloTrocaMeses?: number | null;
  dataUltimaTroca?: string | null;
}

export type StatusManutencao =
  | 'AGENDADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'PENDENTE_SINCRONIZACAO';

export type TipoManutencao = 'PREVENTIVA' | 'CORRETIVA';
export type PrioridadeManutencao = 'BAIXA' | 'MEDIA' | 'ALTA';

export interface Manutencao {
  id: string;
  numeroOS: string;
  status: StatusManutencao;
  tipo: TipoManutencao;
  prioridade: PrioridadeManutencao;
  inicio: string | null;
  fim: string | null;
  observacao?: string | null;
  chamadoAvulso: boolean;
  condominio: { id: string; nome: string; endereco: string; bairro: string };
  // Nulo quando a OS foi gerada automaticamente pelo sistema e ainda não
  // teve técnico atribuído manualmente.
  tecnico: { id: string; nome: string } | null;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  quantidadeMinima: number;
  custoUnitario?: number | null;
  fornecedor?: string | null;
}

export interface MovimentacaoEstoque {
  id: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  motivo?: string | null;
  createdAt: string;
}

export type StatusChecklistItem = 'OK' | 'DEFEITO' | 'NAO_APLICAVEL';

export interface ChecklistItem {
  id: string;
  item: string;
  status: StatusChecklistItem;
  observacao?: string | null;
}

export interface ChecklistModeloItem {
  id: string;
  item: string;
  ordem: number;
}

export interface ChecklistModelo {
  id: string;
  tipo: TipoManutencao;
  nome: string;
  itens: ChecklistModeloItem[];
}

export interface ManutencaoDetalhe extends Manutencao {
  observacao?: string | null;
  assinaturaUrl?: string | null;
  pdfUrl?: string | null;
  latitudeCheckin?: number | null;
  longitudeCheckin?: number | null;
  checklist: ChecklistItem[];
  pecas: { id: string; nome: string; quantidade: number }[];
  fotos: Foto[];
}

export type TipoFoto = 'ANTES' | 'DEPOIS';

export interface Foto {
  id: string;
  arquivoUrl: string;
  tipo: TipoFoto;
  createdAt: string;
}

export type StatusCondominio = 'CONCLUIDO' | 'PENDENTE' | 'ATRASADO';

export interface DashboardCondominioResumo {
  id: string;
  nome: string;
  bairro: string;
  status: StatusCondominio;
  ultimaManutencao: string | null;
  numeroCameras: number;
}

export interface DashboardTecnicoResumo {
  id: string;
  nome: string;
  status: 'EM_CAMPO' | 'DISPONIVEL';
  condominioAtual: string | null;
  osAbertas: number;
}

export interface DashboardResumo {
  condominios: {
    total: number;
    concluidos: number;
    pendentes: number;
    atrasados: number;
    lista: DashboardCondominioResumo[];
  };
  ordensServico: {
    abertas: number;
    emAndamento: number;
    atrasadas: number;
    concluidas: number;
    total: number;
  };
  tecnicos: {
    emCampo: number;
    disponivel: number;
    lista: DashboardTecnicoResumo[];
  };
}

export interface PecaHistorico {
  id: string;
  nome: string;
  quantidade: number;
  motivoTroca?: string | null;
  createdAt: string;
  manutencao: {
    numeroOS: string;
    condominio: { id: string; nome: string };
    tecnico: { nome: string };
  };
  equipamento?: { tipo: string; local: string | null } | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'GESTOR' | 'TECNICO';
  ativo: boolean;
}

export interface NovoEquipamentoForm {
  condominioId: string;
  tipo: string;
  fabricante: string;
  modelo: string;
  numeroSerie?: string;
  patrimonio?: string;
  dataInstalacao: string;
}

export interface NovoCondominioForm {
  nome: string;
  cnpj?: string;
  cpf?: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  sindico?: string;
  zelador?: string;
  periodicidade: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'GESTOR' | 'TECNICO';
}
