import { useEffect, useState, CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { api, ApiError } from '../api/client';
import { Manutencao, StatusManutencao } from '../api/types';
import { useAuth } from '../context/AuthContext';

const FILTROS: { label: string; valor: StatusManutencao | 'TODAS' }[] = [
  { label: 'Todas', valor: 'TODAS' },
  { label: 'Agendadas', valor: 'AGENDADA' },
  { label: 'Em andamento', valor: 'EM_ANDAMENTO' },
  { label: 'Concluídas', valor: 'CONCLUIDA' },
  { label: 'Canceladas', valor: 'CANCELADA' },
];

function agruparPorDia(manutencoes: Manutencao[]): [string, Manutencao[]][] {
  const grupos = new Map<string, Manutencao[]>();

  for (const m of manutencoes) {
    const chave = m.inicio
      ? new Date(m.inicio).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })
      : 'Sem data definida';

    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(m);
  }

  return Array.from(grupos.entries());
}

const STATUS_VALIDOS = FILTROS.map((f) => f.valor);

export function Agenda() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const podeAgendar = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  const statusDaUrl = searchParams.get('status');
  const filtroInicial = STATUS_VALIDOS.includes(
    (statusDaUrl as StatusManutencao | 'TODAS') ?? 'TODAS',
  )
    ? ((statusDaUrl as StatusManutencao | 'TODAS') ?? 'TODAS')
    : 'TODAS';

  const [manutencoes, setManutencoes] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusManutencao | 'TODAS'>(filtroInicial);

  useEffect(() => {
    const query = filtro === 'TODAS' ? '' : `?status=${filtro}`;
    api
      .get<Manutencao[]>(`/manutencoes${query}`)
      .then(setManutencoes)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar a agenda.'));
  }, [filtro]);

  const grupos = manutencoes ? agruparPorDia(manutencoes) : [];

  return (
    <Layout>
      <header style={styles.header}>
        <div>
          <h1 style={styles.titulo}>Agenda</h1>
          <p style={styles.subtitulo}>
            {manutencoes ? `${manutencoes.length} visita(s)` : 'Carregando…'}
          </p>
        </div>

        <div style={styles.headerAcoes}>
          <div style={styles.filtros}>
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                style={{
                  ...styles.filtroBotao,
                  ...(filtro === f.valor ? styles.filtroBotaoAtivo : {}),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {podeAgendar && (
            <button style={styles.botaoNovo} onClick={() => navigate('/agenda/nova')}>
              + Nova visita
            </button>
          )}
        </div>
      </header>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && manutencoes === null && <div style={styles.estado}>Carregando agenda…</div>}

      {!erro && manutencoes !== null && manutencoes.length === 0 && (
        <div style={styles.estado}>Nenhuma visita encontrada para esse filtro.</div>
      )}

      {grupos.map(([dia, itens]) => (
        <section key={dia} style={styles.grupo}>
          <h2 style={styles.diaTitulo}>{dia}</h2>
          <div style={styles.lista}>
            {itens.map((m) => (
              <Link key={m.id} to={`/manutencoes/${m.id}`} style={styles.itemLink}>
                <div style={styles.item}>
                  <div style={styles.itemHorario} className="mono">
                    {m.inicio
                      ? new Date(m.inicio).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'}
                  </div>
                  <div style={styles.itemInfo}>
                    <div style={styles.itemCondominio}>{m.condominio.nome}</div>
                    <div style={styles.itemDetalhe}>
                      {m.tecnico?.nome ?? 'Sem técnico atribuído'} ·{' '}
                      <span className="mono">{m.numeroOS}</span>
                    </div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  titulo: {
    fontSize: '1.5rem',
  },
  subtitulo: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginTop: '0.35rem',
  },
  filtros: {
    display: 'flex',
    gap: '0.4rem',
  },
  headerAcoes: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  botaoNovo: {
    padding: '0.5rem 0.9rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  filtroBotao: {
    padding: '0.4rem 0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  filtroBotaoAtivo: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-strong)',
    fontWeight: 600,
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    padding: '2rem 0',
  },
  grupo: {
    marginBottom: '2rem',
  },
  diaTitulo: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'capitalize',
    marginBottom: '0.6rem',
  },
  lista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  itemLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
  },
  itemHorario: {
    fontSize: '0.85rem',
    color: 'var(--accent-strong)',
    minWidth: 48,
  },
  itemInfo: {
    flex: 1,
  },
  itemCondominio: {
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  itemDetalhe: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
  },
};
