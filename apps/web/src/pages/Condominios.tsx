import { useEffect, useState, CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusCondominioBadge } from '../components/StatusCondominioBadge';
import { IconBuilding, IconCamera, IconChevronRight } from '../components/icons';
import { api, ApiError } from '../api/client';
import { Condominio, DashboardResumo, StatusCondominio } from '../api/types';
import { useAuth } from '../context/AuthContext';

type FiltroStatus = 'TODOS' | StatusCondominio;

const FILTROS_STATUS: { label: string; valor: FiltroStatus }[] = [
  { label: 'Todos', valor: 'TODOS' },
  { label: 'Em dia', valor: 'CONCLUIDO' },
  { label: 'Pendentes', valor: 'PENDENTE' },
  { label: 'Atrasados', valor: 'ATRASADO' },
];

export function Condominios() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusInicial = (searchParams.get('status') as FiltroStatus | null) ?? 'TODOS';

  const [condominios, setCondominios] = useState<Condominio[] | null>(null);
  const [statusPorId, setStatusPorId] = useState<Record<string, { status: StatusCondominio; ultimaManutencao: string | null }>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(statusInicial);

  const podeCriar = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  useEffect(() => {
    api
      .get<Condominio[]>('/condominios')
      .then(setCondominios)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os condomínios.'));

    api
      .get<DashboardResumo>('/dashboard')
      .then((resumo) => {
        const mapa: Record<string, { status: StatusCondominio; ultimaManutencao: string | null }> = {};
        resumo.condominios.lista.forEach((c) => {
          mapa[c.id] = { status: c.status, ultimaManutencao: c.ultimaManutencao };
        });
        setStatusPorId(mapa);
      })
      .catch(() => setStatusPorId({}));
  }, []);

  const buscaLower = busca.trim().toLowerCase();
  const lista = (condominios ?? [])
    .filter(
      (c) =>
        !buscaLower ||
        c.nome.toLowerCase().includes(buscaLower) ||
        c.bairro.toLowerCase().includes(buscaLower),
    )
    .filter((c) => filtroStatus === 'TODOS' || statusPorId[c.id]?.status === filtroStatus);

  return (
    <Layout titulo="Condomínios">
      <div style={styles.topo}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou bairro…"
          style={styles.busca}
        />
        {podeCriar && (
          <button style={styles.botaoNovo} onClick={() => navigate('/condominios/novo')}>
            + Novo condomínio
          </button>
        )}
      </div>

      <div style={styles.filtros}>
        {FILTROS_STATUS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltroStatus(f.valor)}
            style={{
              ...styles.filtroBotao,
              ...(filtroStatus === f.valor ? styles.filtroBotaoAtivo : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && condominios === null && <TabelaSkeleton />}

      {condominios && lista.length === 0 && (
        <div style={styles.estadoVazio}>
          <span style={styles.estadoVazioIcone}>
            <IconBuilding size={22} />
          </span>
          <span style={styles.estadoVazioTitulo}>Nenhum condomínio encontrado</span>
          <span style={styles.estadoVazioSubtitulo}>
            {podeCriar && condominios.length === 0 ? (
              <>
                Comece cadastrando o primeiro.{' '}
                <Link to="/condominios/novo" style={styles.link}>
                  Cadastrar agora
                </Link>
              </>
            ) : (
              'Tente ajustar sua busca.'
            )}
          </span>
        </div>
      )}

      {lista.length > 0 && (
        <table style={styles.tabela}>
          <colgroup>
            <col style={{ width: '32%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}>Condomínio</th>
              <th style={styles.th}>Síndico</th>
              <th style={styles.th}>Câmeras</th>
              <th style={styles.th}>Última manutenção</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const info = statusPorId[c.id];
              const inicial = c.nome.charAt(0).toUpperCase();
              return (
                <tr
                  key={c.id}
                  style={styles.linhaClicavel}
                  onClick={() => navigate(`/condominios/${c.id}`)}
                >
                  <td style={styles.tdEllipsis}>
                    <div style={styles.condominioCelula}>
                      <span style={styles.avatar}>{inicial}</span>
                      <div style={styles.condominioTextos}>
                        <span style={styles.condominioNome}>{c.nome}</span>
                        <span style={styles.condominioBairro}>{c.bairro}</span>
                      </div>
                    </div>
                  </td>
                  <td style={styles.tdEllipsis}>{c.sindico || '-'}</td>
                  <td style={styles.td}>
                    <span style={styles.camerasCelula}>
                      <IconCamera size={13} color="var(--text-tertiary)" />
                      {c._count?.equipamentos ?? 0}
                    </span>
                  </td>
                  <td style={styles.td} className="mono">
                    {info?.ultimaManutencao
                      ? new Date(info.ultimaManutencao).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>
                  <td style={styles.td}>
                    {info ? <StatusCondominioBadge status={info.status} /> : '-'}
                  </td>
                  <td style={styles.td}>
                    <IconChevronRight size={15} color="var(--text-tertiary)" />
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

function TabelaSkeleton() {
  return (
    <div style={styles.skeletonContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={styles.skeletonLinha}>
          <div style={styles.skeletonAvatar} />
          <div style={{ flex: 1 }}>
            <div style={{ ...styles.skeletonBloco, width: '35%', height: 13, marginBottom: 6 }} />
            <div style={{ ...styles.skeletonBloco, width: '20%', height: 10 }} />
          </div>
          <div style={{ ...styles.skeletonBloco, width: 70, height: 20, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  topo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
    gap: '1rem',
  },
  busca: {
    flex: 1,
    maxWidth: 360,
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    background: '#fff',
  },
  botaoNovo: {
    padding: '0.6rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  link: { color: 'var(--accent-strong)', fontWeight: 600 },
  filtros: { display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
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
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  estadoVazio: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '2.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  },
  estadoVazioIcone: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--info-soft)',
    color: 'var(--info)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.4rem',
  },
  estadoVazioTitulo: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' },
  estadoVazioSubtitulo: { fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' },
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
  linhaClicavel: { cursor: 'pointer' },
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
  condominioCelula: { display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--accent-soft)',
    color: 'var(--accent-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  condominioTextos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  condominioNome: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-heading)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  condominioBairro: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  camerasCelula: { display: 'flex', alignItems: 'center', gap: '0.35rem' },

  skeletonContainer: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
  },
  skeletonLinha: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 0.9rem',
    borderBottom: '1px solid var(--border)',
  },
  skeletonAvatar: { width: 30, height: 30, borderRadius: '50%', background: '#eceef1', flexShrink: 0 },
  skeletonBloco: { background: '#eceef1', borderRadius: 4 },
};
