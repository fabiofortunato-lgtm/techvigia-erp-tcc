import { useEffect, useState, CSSProperties, ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusCondominioBadge } from '../components/StatusCondominioBadge';
import { api, ApiError } from '../api/client';
import { DashboardResumo } from '../api/types';
import {
  IconBuilding,
  IconCheckCircle,
  IconClock,
  IconAlertTriangle,
  IconWrench,
  IconMapPin,
  IconDonut,
  IconBarChart,
  IconUsers,
} from '../components/icons';

const RAIO_DONUT = 56;
const CIRCUNFERENCIA_DONUT = 2 * Math.PI * RAIO_DONUT;

export function Dashboard() {
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardResumo>('/dashboard')
      .then(setResumo)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar o resumo.'));
  }, []);

  if (erro) {
    return (
      <Layout titulo="Dashboard">
        <div style={styles.erro}>{erro}</div>
      </Layout>
    );
  }

  if (!resumo) {
    return (
      <Layout titulo="Dashboard">
        <div style={styles.estado}>Carregando…</div>
      </Layout>
    );
  }

  const { condominios, ordensServico, tecnicos } = resumo;

  const cards = [
    {
      label: 'Condomínios',
      valor: condominios.total,
      destaque: true,
      Icone: IconBuilding,
      link: '/condominios',
    },
    {
      label: 'Cond. em dia',
      valor: condominios.concluidos,
      cor: 'var(--success)',
      corFundo: 'var(--success-soft)',
      Icone: IconCheckCircle,
      link: '/condominios?status=CONCLUIDO',
    },
    {
      label: 'Cond. pendentes',
      valor: condominios.pendentes,
      cor: 'var(--warning)',
      corFundo: 'var(--warning-soft)',
      Icone: IconClock,
      link: '/condominios?status=PENDENTE',
    },
    {
      label: 'Cond. atrasados',
      valor: condominios.atrasados,
      cor: 'var(--danger)',
      corFundo: 'var(--danger-soft)',
      Icone: IconAlertTriangle,
      link: '/condominios?status=ATRASADO',
    },
    {
      label: 'OS abertas',
      valor: ordensServico.abertas,
      cor: 'var(--info)',
      corFundo: 'var(--info-soft)',
      Icone: IconWrench,
      link: '/ordens-servico?status=ABERTAS',
    },
    {
      label: 'Téc. em campo',
      valor: tecnicos.emCampo,
      cor: 'var(--accent-bright)',
      corFundo: 'var(--accent-bright-soft)',
      Icone: IconMapPin,
      link: '/tecnicos',
    },
  ];

  return (
    <Layout titulo="Dashboard">
      <div style={styles.statsGrid}>
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            style={{
              ...styles.statCard,
              ...(card.destaque ? styles.statCardDestaque : {}),
            }}
          >
            <span
              style={{
                ...styles.statIcone,
                backgroundColor: card.destaque ? 'rgba(255,255,255,0.12)' : card.corFundo,
                color: card.destaque ? 'var(--text-on-dark)' : card.cor,
              }}
            >
              <card.Icone size={17} />
            </span>
            <span
              style={{
                ...styles.statValor,
                ...(card.destaque
                  ? { color: 'var(--text-on-dark)' }
                  : { color: card.cor }),
              }}
            >
              {card.valor}
            </span>
            <span
              style={{
                ...styles.statLabel,
                ...(card.destaque ? { color: 'var(--text-on-dark-muted)' } : {}),
              }}
            >
              {card.label}
            </span>
          </Link>
        ))}
      </div>

      <div style={styles.graficosGrid}>
        <div style={styles.card}>
          <TituloCard Icone={IconDonut} cor="var(--success)" fundo="var(--success-soft)">
            Status dos condomínios
          </TituloCard>
          <DonutStatusCondominios condominios={condominios} />
        </div>

        <div style={styles.card}>
          <TituloCard Icone={IconBarChart} cor="var(--info)" fundo="var(--info-soft)">
            Ordens de serviço por status
          </TituloCard>
          <BarrasOrdensServico ordensServico={ordensServico} />
        </div>
      </div>

      <div style={styles.tabelasGrid}>
        <div style={styles.card}>
          <TituloCard Icone={IconBuilding} cor="var(--accent-strong)" fundo="var(--accent-soft)">
            Condomínios
          </TituloCard>
          <TabelaCondominios lista={condominios.lista.slice(0, 6)} />
        </div>

        <div style={styles.card}>
          <TituloCard Icone={IconUsers} cor="var(--warning)" fundo="var(--warning-soft)">
            Técnicos
          </TituloCard>
          <PainelTecnicos lista={tecnicos.lista} />
        </div>
      </div>
    </Layout>
  );
}

function TituloCard({
  Icone,
  cor,
  fundo,
  children,
}: {
  Icone: ComponentType<{ size?: number; color?: string }>;
  cor: string;
  fundo: string;
  children: string;
}) {
  return (
    <div style={styles.tituloCardLinha}>
      <span style={{ ...styles.tituloCardIcone, backgroundColor: fundo, color: cor }}>
        <Icone size={14} />
      </span>
      <h2 style={styles.cardTitulo}>{children}</h2>
    </div>
  );
}

function DonutStatusCondominios({
  condominios,
}: {
  condominios: DashboardResumo['condominios'];
}) {
  const total = condominios.total || 1; // evita divisão por zero quando não há condomínio
  const segmentos = [
    { valor: condominios.concluidos, cor: 'var(--success)', label: 'Concluído' },
    { valor: condominios.pendentes, cor: 'var(--warning)', label: 'Pendente' },
    { valor: condominios.atrasados, cor: 'var(--danger)', label: 'Atrasado' },
  ];

  let acumulado = 0;

  return (
    <div style={styles.donutLinha}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={RAIO_DONUT} fill="none" stroke="#eef2f6" strokeWidth="18" />
        {segmentos.map((seg) => {
          const comprimento = (seg.valor / total) * CIRCUNFERENCIA_DONUT;
          const offset = -acumulado;
          acumulado += comprimento;
          if (seg.valor === 0) return null;
          return (
            <circle
              key={seg.label}
              cx="70"
              cy="70"
              r={RAIO_DONUT}
              fill="none"
              stroke={seg.cor}
              strokeWidth="18"
              strokeDasharray={`${comprimento} ${CIRCUNFERENCIA_DONUT - comprimento}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>

      <div style={styles.legenda}>
        {segmentos.map((seg) => (
          <div key={seg.label} style={styles.legendaItem}>
            <span style={{ ...styles.legendaBolinha, background: seg.cor }} />
            <span style={styles.legendaLabel}>{seg.label}</span>
            <span style={styles.legendaValor}>{seg.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarrasOrdensServico({
  ordensServico,
}: {
  ordensServico: DashboardResumo['ordensServico'];
}) {
  const total = ordensServico.total || 1;
  const barras = [
    { label: 'Abertas', valor: ordensServico.abertas, cor: 'var(--info)' },
    { label: 'Em andamento', valor: ordensServico.emAndamento, cor: 'var(--warning)' },
    { label: 'Atrasadas', valor: ordensServico.atrasadas, cor: 'var(--danger)' },
    { label: 'Concluídas', valor: ordensServico.concluidas, cor: 'var(--success)' },
  ];

  return (
    <div style={styles.barrasContainer}>
      {barras.map((barra) => (
        <div key={barra.label} style={styles.barraLinha}>
          <div style={styles.barraCabecalho}>
            <span style={styles.barraLabel}>{barra.label}</span>
            <span style={styles.barraValor}>{barra.valor}</span>
          </div>
          <div style={styles.barraTrilho}>
            <div
              style={{
                ...styles.barraPreenchimento,
                width: `${(barra.valor / total) * 100}%`,
                background: barra.cor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabelaCondominios({ lista }: { lista: DashboardResumo['condominios']['lista'] }) {
  if (lista.length === 0) {
    return <div style={styles.estadoVazio}>Nenhum condomínio cadastrado ainda.</div>;
  }

  return (
    <table style={styles.tabela}>
      <colgroup>
        <col style={{ width: '55%' }} />
        <col style={{ width: '25%' }} />
        <col style={{ width: 110 }} />
      </colgroup>
      <thead>
        <tr>
          <th style={styles.th}>Condomínio</th>
          <th style={styles.th}>Bairro</th>
          <th style={styles.th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((c) => (
          <tr key={c.id}>
            <td style={styles.tdEllipsis}>
              <Link to={`/condominios/${c.id}`} style={styles.linkTabela}>
                {c.nome}
              </Link>
            </td>
            <td style={styles.tdEllipsis}>{c.bairro}</td>
            <td style={styles.td}>
              <StatusCondominioBadge status={c.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PainelTecnicos({ lista }: { lista: DashboardResumo['tecnicos']['lista'] }) {
  if (lista.length === 0) {
    return <div style={styles.estadoVazio}>Nenhum técnico cadastrado ainda.</div>;
  }

  return (
    <div style={styles.tecnicosLista}>
      {lista.map((t) => (
        <div key={t.id} style={styles.tecnicoLinha}>
          <span
            style={{
              ...styles.tecnicoBolinha,
              background: t.status === 'EM_CAMPO' ? 'var(--accent)' : 'var(--success)',
            }}
          />
          <div style={styles.tecnicoInfo}>
            <span style={styles.tecnicoNome}>{t.nome}</span>
            <span style={styles.tecnicoDetalhe}>
              {t.status === 'EM_CAMPO' && t.condominioAtual
                ? `Em campo · ${t.condominioAtual}`
                : 'Disponível'}
            </span>
          </div>
          <span style={styles.tecnicoOsCount}>{t.osAbertas} OS</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  titulo: { fontSize: '1.4rem', marginBottom: '1.5rem' },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  estadoVazio: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    padding: '1rem 0',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: '1.1rem',
    marginBottom: '2rem',
  },
  statCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  statCardDestaque: {
    background: 'var(--surface-dark)',
    border: '1px solid var(--surface-dark)',
  },
  statIcone: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.15rem',
  },
  statValor: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 },
  statLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  graficosGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem',
    marginBottom: '1.25rem',
  },
  tabelasGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '1.25rem',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '1.25rem',
  },
  cardTitulo: { fontSize: '0.95rem' },
  tituloCardLinha: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '1.1rem',
  },
  tituloCardIcone: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  donutLinha: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  legenda: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  legendaItem: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  legendaBolinha: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  legendaLabel: { fontSize: '0.82rem', color: 'var(--text)', flex: 1 },
  legendaValor: { fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 },

  barrasContainer: { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  barraLinha: {},
  barraCabecalho: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.35rem',
    fontSize: '0.82rem',
  },
  barraLabel: { color: 'var(--text)' },
  barraValor: { color: 'var(--text-muted)', fontWeight: 700 },
  barraTrilho: {
    height: 10,
    background: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barraPreenchimento: { height: '100%', borderRadius: 6 },

  tabela: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '0.6rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
  },
  tdEllipsis: {
    padding: '0.6rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkTabela: { color: 'var(--text-heading)', textDecoration: 'none', fontWeight: 600 },

  tecnicosLista: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  tecnicoLinha: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  tecnicoBolinha: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  tecnicoInfo: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  tecnicoNome: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' },
  tecnicoDetalhe: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tecnicoOsCount: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 },
};
