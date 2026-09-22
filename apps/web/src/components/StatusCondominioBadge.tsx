import { CSSProperties } from 'react';
import { StatusCondominio } from '../api/types';

const CONFIG: Record<StatusCondominio, { label: string; cor: string; fundo: string }> = {
  CONCLUIDO: { label: 'Concluído', cor: 'var(--success)', fundo: 'var(--success-soft)' },
  PENDENTE: { label: 'Pendente', cor: 'var(--warning)', fundo: 'var(--warning-soft)' },
  ATRASADO: { label: 'Atrasado', cor: 'var(--danger)', fundo: 'var(--danger-soft)' },
};

export function StatusCondominioBadge({ status }: { status: StatusCondominio }) {
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
