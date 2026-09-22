// Calcula quando um equipamento precisa da próxima troca periódica (ex:
// bateria trocada a cada 12 meses) e classifica o status pra exibição.
// Compartilhado entre a lista de equipamentos dentro do condomínio e a
// tela geral de Equipamentos - as duas mostram o mesmo indicador.

export type StatusTroca = 'SEM_CONTROLE' | 'OK' | 'PROXIMO' | 'ATRASADO';

// Dentro desse prazo antes da data calculada, já avisa "próximo da troca"
// em vez de esperar a data passar de vez.
const DIAS_ALERTA_PROXIMO = 30;

interface EquipamentoComTroca {
  intervaloTrocaMeses?: number | null;
  dataUltimaTroca?: string | null;
  dataInstalacao: string;
}

export function calcularProximaTroca(eq: EquipamentoComTroca): Date | null {
  if (!eq.intervaloTrocaMeses) return null;

  const base = new Date(eq.dataUltimaTroca ?? eq.dataInstalacao);
  const proxima = new Date(base);
  proxima.setMonth(proxima.getMonth() + eq.intervaloTrocaMeses);
  return proxima;
}

export function statusTroca(eq: EquipamentoComTroca): {
  status: StatusTroca;
  proximaTroca: Date | null;
  diasRestantes: number | null;
} {
  const proximaTroca = calcularProximaTroca(eq);
  if (!proximaTroca) {
    return { status: 'SEM_CONTROLE', proximaTroca: null, diasRestantes: null };
  }

  const diasRestantes = Math.ceil(
    (proximaTroca.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (diasRestantes < 0) return { status: 'ATRASADO', proximaTroca, diasRestantes };
  if (diasRestantes <= DIAS_ALERTA_PROXIMO) return { status: 'PROXIMO', proximaTroca, diasRestantes };
  return { status: 'OK', proximaTroca, diasRestantes };
}

export const LABEL_STATUS_TROCA: Record<StatusTroca, string> = {
  SEM_CONTROLE: 'Sem controle',
  OK: 'Em dia',
  PROXIMO: 'Próximo da troca',
  ATRASADO: 'Troca atrasada',
};

export const COR_STATUS_TROCA: Record<StatusTroca, { cor: string; fundo: string }> = {
  SEM_CONTROLE: { cor: 'var(--text-muted)', fundo: '#eef2f6' },
  OK: { cor: 'var(--success)', fundo: 'var(--success-soft)' },
  PROXIMO: { cor: 'var(--warning)', fundo: 'var(--warning-soft)' },
  ATRASADO: { cor: 'var(--danger)', fundo: 'var(--danger-soft)' },
};
