import { CSSProperties } from 'react';
import { StatusManutencao } from '../api/types';

// Cores exatas do protótipo de design (Fase B, 17/07/2026):
// Aberta = azul info, Em andamento = âmbar, Concluída = verde,
// Pendente sync. = vermelho, Cancelada = cinza neutro.
const CONFIG: Record<StatusManutencao, { label: string; cor: string; fundo: string }> = {
  AGENDADA: { label: 'Aberta', cor: 'var(--info)', fundo: 'var(--info-soft)' },
  EM_ANDAMENTO: { label: 'Em andamento', cor: 'var(--warning)', fundo: 'var(--warning-soft)' },
  CONCLUIDA: { label: 'Concluída', cor: 'var(--success)', fundo: 'var(--success-soft)' },
  CANCELADA: { label: 'Cancelada', cor: 'var(--text-muted)', fundo: '#eef2f6' },
  PENDENTE_SINCRONIZACAO: { label: 'Pendente sync.', cor: 'var(--danger)', fundo: 'var(--danger-soft)' },
};

export function StatusBadge({ status }: { status: StatusManutencao }) {
  const config = CONFIG[status];

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: config.cor,
    background: config.fundo,
    padding: '0.22rem 0.65rem',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap',
  };

  const pontoStyle: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: config.cor,
    flexShrink: 0,
  };

  return (
    <span style={style}>
      <span style={pontoStyle} />
      {config.label}
    </span>
  );
}
