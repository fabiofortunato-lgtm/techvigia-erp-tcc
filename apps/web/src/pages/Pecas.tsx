import { useEffect, useState, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { PecaHistorico } from '../api/types';

export function Pecas() {
  const [pecas, setPecas] = useState<PecaHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api
      .get<PecaHistorico[]>('/pecas')
      .then(setPecas)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar o histórico de peças.'));
  }, []);

  const buscaLower = busca.trim().toLowerCase();
  const lista = (pecas ?? []).filter(
    (p) =>
      !buscaLower ||
      p.nome.toLowerCase().includes(buscaLower) ||
      p.manutencao.condominio.nome.toLowerCase().includes(buscaLower),
  );

  return (
    <Layout titulo="Peças">
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por peça ou condomínio…"
        style={styles.busca}
      />

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && pecas === null && <div style={styles.estado}>Carregando…</div>}

      {pecas && lista.length === 0 && (
        <div style={styles.estadoVazio}>Nenhuma peça registrada ainda.</div>
      )}

      {lista.length > 0 && (
        <table style={styles.tabela}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}>Peça</th>
              <th style={styles.th}>Condomínio</th>
              <th style={styles.th}>Equipamento</th>
              <th style={styles.th}>Motivo</th>
              <th style={styles.th}>Técnico / Data</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td style={styles.tdEllipsis}>
                  {p.quantidade}x {p.nome}
                </td>
                <td style={styles.tdEllipsis}>
                  <Link to={`/condominios/${p.manutencao.condominio.id}`} style={styles.link}>
                    {p.manutencao.condominio.nome}
                  </Link>
                </td>
                <td style={styles.tdEllipsis}>
                  {p.equipamento ? `${p.equipamento.tipo}${p.equipamento.local ? ` · ${p.equipamento.local}` : ''}` : '-'}
                </td>
                <td style={styles.tdEllipsis}>{p.motivoTroca || '-'}</td>
                <td style={styles.td}>
                  <div>{p.manutencao.tecnico.nome}</div>
                  <div style={styles.dataSecundaria} className="mono">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  busca: {
    width: '100%',
    maxWidth: 360,
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    marginBottom: '1.25rem',
    background: '#fff',
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
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
  dataSecundaria: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' },
};
