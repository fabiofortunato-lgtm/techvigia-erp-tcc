import { useEffect, useState, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { DashboardResumo, DashboardTecnicoResumo } from '../api/types';

export function Tecnicos() {
  const [tecnicos, setTecnicos] = useState<DashboardTecnicoResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardResumo>('/dashboard')
      .then((resumo) => setTecnicos(resumo.tecnicos.lista))
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os técnicos.'));
  }, []);

  return (
    <Layout titulo="Técnicos">
      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && tecnicos === null && <div style={styles.estado}>Carregando…</div>}

      {tecnicos && tecnicos.length === 0 && (
        <div style={styles.estadoVazio}>Nenhum técnico cadastrado ainda.</div>
      )}

      {tecnicos && tecnicos.length > 0 && (
        <div style={styles.grid}>
          {tecnicos.map((t) => (
            <Link key={t.id} to={`/ordens-servico?tecnicoId=${t.id}`} style={styles.cardLink}>
              <div style={styles.card}>
                <div style={styles.cardTopo}>
                  <span
                    style={{
                      ...styles.statusBolinha,
                      background: t.status === 'EM_CAMPO' ? 'var(--accent)' : 'var(--success)',
                    }}
                  />
                  <span style={styles.statusTexto}>
                    {t.status === 'EM_CAMPO' ? 'Em campo' : 'Disponível'}
                  </span>
                </div>
                <h2 style={styles.nome}>{t.nome}</h2>
                <p style={styles.condominioAtual}>
                  {t.status === 'EM_CAMPO' && t.condominioAtual
                    ? t.condominioAtual
                    : 'Sem atendimento em andamento'}
                </p>
                <div style={styles.rodape}>
                  <span style={styles.osCount}>{t.osAbertas}</span>
                  <span style={styles.osLabel}>OS em aberto</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  estadoVazio: { color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '1rem',
  },
  cardLink: { textDecoration: 'none', color: 'inherit' },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '1.25rem',
  },
  cardTopo: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' },
  statusBolinha: { width: 9, height: 9, borderRadius: '50%' },
  statusTexto: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  nome: { fontSize: '1.05rem', marginBottom: '0.4rem' },
  condominioAtual: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: 0,
    minHeight: '1.3em',
  },
  rodape: {
    marginTop: '1rem',
    paddingTop: '0.85rem',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  osCount: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-heading)' },
  osLabel: { fontSize: '0.78rem', color: 'var(--text-muted)' },
};
