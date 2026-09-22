import { useEffect, useState, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { Equipamento, Condominio } from '../api/types';
import {
  statusTroca,
  LABEL_STATUS_TROCA,
  COR_STATUS_TROCA,
  StatusTroca,
} from '../utils/equipamento';

const FILTROS_TROCA: { label: string; valor: StatusTroca | 'TODOS' }[] = [
  { label: 'Todos', valor: 'TODOS' },
  { label: 'Em dia', valor: 'OK' },
  { label: 'Próximo da troca', valor: 'PROXIMO' },
  { label: 'Troca atrasada', valor: 'ATRASADO' },
  { label: 'Sem controle', valor: 'SEM_CONTROLE' },
];

export function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[] | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroTroca, setFiltroTroca] = useState<StatusTroca | 'TODOS'>('TODOS');
  const [condominioIdFiltro, setCondominioIdFiltro] = useState('');

  useEffect(() => {
    api
      .get<Equipamento[]>('/equipamentos')
      .then(setEquipamentos)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os equipamentos.'));
    api.get<Condominio[]>('/condominios').then(setCondominios).catch(() => setCondominios([]));
  }, []);

  const buscaLower = busca.trim().toLowerCase();
  const lista = (equipamentos ?? [])
    .filter((eq) => {
      if (!buscaLower) return true;
      const alvo = [eq.tipo, eq.fabricante, eq.modelo, eq.local, eq.numeroSerie, eq.condominio?.nome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return alvo.includes(buscaLower);
    })
    .filter((eq) => !condominioIdFiltro || eq.condominioId === condominioIdFiltro)
    .filter((eq) => filtroTroca === 'TODOS' || statusTroca(eq).status === filtroTroca);

  return (
    <Layout titulo="Equipamentos">
      <div style={styles.painelFiltros}>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Buscar</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Tipo, fabricante, modelo, série, cliente…"
            style={styles.inputFiltro}
          />
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Cliente</label>
          <select
            value={condominioIdFiltro}
            onChange={(e) => setCondominioIdFiltro(e.target.value)}
            style={styles.inputFiltro}
          >
            <option value="">Todos os clientes</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.filtrosTroca}>
        {FILTROS_TROCA.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltroTroca(f.valor)}
            style={{
              ...styles.filtroBotao,
              ...(filtroTroca === f.valor ? styles.filtroBotaoAtivo : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && equipamentos === null && <div style={styles.estado}>Carregando…</div>}

      {!erro && equipamentos !== null && lista.length === 0 && (
        <div style={styles.estadoVazio}>Nenhum equipamento encontrado para esse filtro.</div>
      )}

      {lista.length > 0 && (
        <table style={styles.tabela}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}></th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Fabricante / Modelo</th>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Local</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Troca</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((eq) => {
              const troca = statusTroca(eq);
              const corTroca = COR_STATUS_TROCA[troca.status];
              return (
                <tr key={eq.id}>
                  <td style={styles.td}>
                    {eq.fotoUrl ? (
                      <img src={eq.fotoUrl} alt="" style={styles.miniaturaFoto} />
                    ) : (
                      <span style={styles.semFoto} />
                    )}
                  </td>
                  <td style={styles.tdEllipsis}>{eq.tipo}</td>
                  <td style={styles.tdEllipsis}>
                    {eq.fabricante} — {eq.modelo}
                  </td>
                  <td style={styles.tdEllipsis}>
                    {eq.condominio ? (
                      <Link to={`/condominios/${eq.condominio.id}`} style={styles.link}>
                        {eq.condominio.nome}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={styles.tdEllipsis}>{eq.local || '-'}</td>
                  <td style={styles.td}>
                    <span style={styles.statusLinha}>
                      <span
                        style={{
                          ...styles.statusBolinha,
                          background: eq.status === 'DEFEITO' ? 'var(--danger)' : 'var(--success)',
                        }}
                      />
                      {eq.status === 'DEFEITO' ? 'Defeito' : 'OK'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {troca.status === 'SEM_CONTROLE' ? (
                      <span style={styles.semControle}>-</span>
                    ) : (
                      <span
                        style={{
                          ...styles.statusBadgeTroca,
                          color: corTroca.cor,
                          background: corTroca.fundo,
                        }}
                        title={
                          troca.proximaTroca
                            ? `Próxima troca: ${troca.proximaTroca.toLocaleDateString('pt-BR')}`
                            : undefined
                        }
                      >
                        {LABEL_STATUS_TROCA[troca.status]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  painelFiltros: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.9rem',
  },
  campoFiltro: { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 220 },
  labelFiltro: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  inputFiltro: {
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--text)',
    background: '#fff',
  },
  filtrosTroca: { display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  filtroBotao: {
    padding: '0.4rem 0.85rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  filtroBotaoAtivo: {
    background: 'var(--surface-dark)',
    borderColor: 'var(--surface-dark)',
    color: '#fff',
    fontWeight: 600,
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' },
  estadoVazio: { color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' },
  tabela: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.7rem 0.9rem',
    borderBottom: '1px solid var(--border)',
    background: '#f8fafc',
  },
  td: {
    padding: '0.7rem 0.9rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
  },
  tdEllipsis: {
    padding: '0.7rem 0.9rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  link: { color: 'var(--text-heading)', textDecoration: 'none', fontWeight: 600 },
  miniaturaFoto: {
    width: 32,
    height: 32,
    borderRadius: 4,
    objectFit: 'cover',
    border: '1px solid var(--border)',
  },
  semFoto: { display: 'inline-block', width: 32, height: 32 },
  statusLinha: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  statusBolinha: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusBadgeTroca: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.22rem 0.65rem',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap',
  },
  semControle: { color: 'var(--text-muted)', fontSize: '0.85rem' },
};
