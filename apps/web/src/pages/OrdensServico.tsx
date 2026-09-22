import { useEffect, useState, CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { Manutencao, PrioridadeManutencao, Condominio, Usuario, Equipamento } from '../api/types';

type FiltroOS = 'TODAS' | 'ABERTAS' | 'EM_ANDAMENTO' | 'ATRASADAS' | 'CONCLUIDAS';

const FILTROS: { label: string; valor: FiltroOS }[] = [
  { label: 'Todas', valor: 'TODAS' },
  { label: 'Abertas', valor: 'ABERTAS' },
  { label: 'Em andamento', valor: 'EM_ANDAMENTO' },
  { label: 'Atrasadas', valor: 'ATRASADAS' },
  { label: 'Concluídas', valor: 'CONCLUIDAS' },
];

const CORES_PRIORIDADE: Record<PrioridadeManutencao, string> = {
  BAIXA: 'var(--text-muted)',
  MEDIA: 'var(--warning)',
  ALTA: 'var(--danger)',
};

// Chamado avulso (criado pelo app mobile com inicio = "agora") ganha essa
// tolerância antes de virar "atrasada" - sem isso, virava atrasado
// segundos depois de criado, já que "agora" sempre já é passado no
// instante seguinte. Visita agendada de verdade (criada aqui no painel,
// com data escolhida) não tem essa tolerância.
const HORAS_TOLERANCIA_CHAMADO_AVULSO = 48;

function statusExibicao(m: Manutencao): { label: string; cor: string; fundo: string } {
  if (m.status === 'CONCLUIDA') return { label: 'Concluída', cor: 'var(--success)', fundo: 'var(--success-soft)' };
  if (m.status === 'CANCELADA') return { label: 'Cancelada', cor: 'var(--text-muted)', fundo: '#eef2f6' };
  if (m.status === 'EM_ANDAMENTO') return { label: 'Em andamento', cor: 'var(--warning)', fundo: 'var(--warning-soft)' };
  if (m.status === 'PENDENTE_SINCRONIZACAO') return { label: 'Pendente sync.', cor: 'var(--danger)', fundo: 'var(--danger-soft)' };
  // AGENDADA: aberta ou atrasada, depende da data
  let atrasada = false;
  if (m.inicio) {
    const inicioMs = new Date(m.inicio).getTime();
    if (m.chamadoAvulso) {
      const limiteMs = Date.now() - HORAS_TOLERANCIA_CHAMADO_AVULSO * 60 * 60 * 1000;
      atrasada = inicioMs < limiteMs;
    } else {
      atrasada = inicioMs < Date.now();
    }
  }
  return atrasada
    ? { label: 'Atrasada', cor: 'var(--danger)', fundo: 'var(--danger-soft)' }
    : { label: 'Aberta', cor: 'var(--info)', fundo: 'var(--info-soft)' };
}

function aplicaFiltro(m: Manutencao, filtro: FiltroOS): boolean {
  const exibicao = statusExibicao(m);
  switch (filtro) {
    case 'TODAS':
      return true;
    case 'ABERTAS':
      return exibicao.label === 'Aberta';
    case 'ATRASADAS':
      return exibicao.label === 'Atrasada';
    case 'EM_ANDAMENTO':
      return m.status === 'EM_ANDAMENTO';
    case 'CONCLUIDAS':
      return m.status === 'CONCLUIDA';
    default:
      return true;
  }
}

export function OrdensServico() {
  const [searchParams] = useSearchParams();
  const tecnicoIdDaUrl = searchParams.get('tecnicoId');
  const statusInicial = (searchParams.get('status') as FiltroOS | null) ?? 'TODAS';

  const [manutencoes, setManutencoes] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroOS>(statusInicial);

  // Filtros adicionais - enviados pro servidor (diferente do filtro de
  // status acima, que é calculado no navegador porque "atrasada"/"aberta"
  // não é um valor puro do banco, depende da hora atual).
  const [numeroOSBusca, setNumeroOSBusca] = useState('');
  const [tecnicoIdSelecionado, setTecnicoIdSelecionado] = useState(tecnicoIdDaUrl ?? '');
  const [condominioNomeBusca, setCondominioNomeBusca] = useState('');
  const [equipamentoIdSelecionado, setEquipamentoIdSelecionado] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

  // Listas pros dropdowns - carregadas uma vez só, não mudam com o filtro
  useEffect(() => {
    api.get<Condominio[]>('/condominios').then(setCondominios).catch(() => setCondominios([]));
    api.get<Usuario[]>('/usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    api.get<Equipamento[]>('/equipamentos').then(setEquipamentos).catch(() => setEquipamentos([]));
  }, []);

  function carregarManutencoes(filtros: {
    numeroOS?: string;
    tecnicoId?: string;
    condominioNome?: string;
    equipamentoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) {
    const params = new URLSearchParams();
    if (filtros.numeroOS) params.set('numeroOS', filtros.numeroOS);
    if (filtros.tecnicoId === '__SEM_TECNICO__') {
      params.set('semTecnico', 'true');
    } else if (filtros.tecnicoId) {
      params.set('tecnicoId', filtros.tecnicoId);
    }
    if (filtros.condominioNome) params.set('condominioNome', filtros.condominioNome);
    if (filtros.equipamentoId) params.set('equipamentoId', filtros.equipamentoId);
    if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio);
    if (filtros.dataFim) params.set('dataFim', filtros.dataFim);
    const query = params.toString();

    setManutencoes(null);
    setErro(null);
    api
      .get<Manutencao[]>(`/manutencoes${query ? `?${query}` : ''}`)
      .then(setManutencoes)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar as ordens de serviço.'));
  }

  useEffect(() => {
    carregarManutencoes({ tecnicoId: tecnicoIdDaUrl ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiltrar() {
    carregarManutencoes({
      numeroOS: numeroOSBusca || undefined,
      tecnicoId: tecnicoIdSelecionado || undefined,
      condominioNome: condominioNomeBusca || undefined,
      equipamentoId: equipamentoIdSelecionado || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });
  }

  function handleLimpar() {
    setNumeroOSBusca('');
    setTecnicoIdSelecionado('');
    setCondominioNomeBusca('');
    setEquipamentoIdSelecionado('');
    setDataInicio('');
    setDataFim('');
    carregarManutencoes({});
  }

  const lista = (manutencoes ?? []).filter((m) => aplicaFiltro(m, filtro));

  return (
    <Layout titulo="Ordens de Serviço">
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

      <div style={styles.painelFiltros}>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Número da OS</label>
          <input
            value={numeroOSBusca}
            onChange={(e) => setNumeroOSBusca(e.target.value)}
            placeholder="Ex.: OS-2026000012"
            style={styles.inputFiltro}
          />
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Técnico</label>
          <select
            value={tecnicoIdSelecionado}
            onChange={(e) => setTecnicoIdSelecionado(e.target.value)}
            style={styles.inputFiltro}
          >
            <option value="">Todos os técnicos</option>
            <option value="__SEM_TECNICO__">⚠️ Sem técnico atribuído</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Cliente</label>
          <input
            list="lista-clientes-os"
            value={condominioNomeBusca}
            onChange={(e) => setCondominioNomeBusca(e.target.value)}
            placeholder="Digite o início do nome…"
            style={styles.inputFiltro}
          />
          <datalist id="lista-clientes-os">
            {condominios.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Equipamento</label>
          <select
            value={equipamentoIdSelecionado}
            onChange={(e) => setEquipamentoIdSelecionado(e.target.value)}
            style={styles.inputFiltro}
          >
            <option value="">Todos os equipamentos</option>
            {equipamentos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.tipo} - {eq.fabricante} {eq.modelo}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Data início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            style={styles.inputFiltro}
          />
        </div>
        <div style={styles.campoFiltro}>
          <label style={styles.labelFiltro}>Data fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            style={styles.inputFiltro}
          />
        </div>
        <div style={styles.botoesFiltro}>
          <button onClick={handleFiltrar} style={styles.botaoFiltrar}>
            Filtrar
          </button>
          <button onClick={handleLimpar} style={styles.botaoLimpar}>
            Limpar
          </button>
        </div>
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && manutencoes === null && <div style={styles.estado}>Carregando…</div>}

      {!erro && manutencoes !== null && lista.length === 0 && (
        <div style={styles.estadoVazio}>Nenhuma ordem de serviço encontrada para esse filtro.</div>
      )}

      {lista.length > 0 && (
        <table style={styles.tabela}>
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}>Condomínio</th>
              <th style={styles.th}>Técnico</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Prioridade</th>
              <th style={styles.th}>Agendada</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const exibicao = statusExibicao(m);
              return (
                <tr key={m.id}>
                  <td style={styles.tdEllipsis}>
                    <Link to={`/manutencoes/${m.id}`} style={styles.link}>
                      {m.condominio.nome}
                    </Link>
                  </td>
                  <td style={styles.tdEllipsis}>
                    {m.tecnico ? (
                      m.tecnico.nome
                    ) : (
                      <span style={styles.semTecnico}>Sem técnico atribuído</span>
                    )}
                  </td>
                  <td style={styles.td}>{m.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Corretiva'}</td>
                  <td style={styles.td}>
                    <span style={styles.prioridadeLinha}>
                      <span
                        style={{
                          ...styles.prioridadeBolinha,
                          background: CORES_PRIORIDADE[m.prioridade],
                        }}
                      />
                      {m.prioridade === 'BAIXA' ? 'Baixa' : m.prioridade === 'MEDIA' ? 'Média' : 'Alta'}
                    </span>
                  </td>
                  <td style={styles.td} className="mono">
                    {m.inicio ? new Date(m.inicio).toLocaleString('pt-BR') : '-'}
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        color: exibicao.cor,
                        background: exibicao.fundo,
                      }}
                    >
                      {exibicao.label}
                    </span>
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
  semTecnico: {
    color: 'var(--warning)',
    fontWeight: 600,
    fontSize: '0.82rem',
  },
  filtros: { display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  painelFiltros: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    padding: '1rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    marginBottom: '1.25rem',
  },
  campoFiltro: { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 160 },
  labelFiltro: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  inputFiltro: {
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--text)',
    background: '#fff',
  },
  botoesFiltro: { display: 'flex', gap: '0.5rem' },
  botaoFiltrar: {
    padding: '0.5rem 1.1rem',
    background: 'var(--accent-strong)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  botaoLimpar: {
    padding: '0.5rem 1.1rem',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
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
  prioridadeLinha: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  prioridadeBolinha: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.22rem 0.65rem',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap',
  },
};
