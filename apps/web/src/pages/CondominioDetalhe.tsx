import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { api, ApiError } from '../api/client';
import { Condominio, Manutencao, Equipamento } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { statusTroca, LABEL_STATUS_TROCA, COR_STATUS_TROCA } from '../utils/equipamento';

export function CondominioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const podeGerenciar = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  const [condominio, setCondominio] = useState<Condominio | null>(null);
  const [manutencoes, setManutencoes] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarFormEquip, setMostrarFormEquip] = useState(false);
  const [equipamentoEditando, setEquipamentoEditando] = useState<Equipamento | null>(null);

  function carregarCondominio() {
    if (!id) return;
    api
      .get<Condominio>(`/condominios/${id}`)
      .then(setCondominio)
      .catch((e: ApiError) => setErro(e.message || 'Condomínio não encontrado.'));
  }

  useEffect(() => {
    if (!id) return;
    carregarCondominio();

    api
      .get<Manutencao[]>(`/manutencoes?condominioId=${id}`)
      .then(setManutencoes)
      .catch(() => setManutencoes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (erro) {
    return (
      <Layout titulo="Condomínio">
        <div style={styles.erro}>{erro}</div>
      </Layout>
    );
  }

  if (!condominio) {
    return (
      <Layout titulo="Condomínio">
        <div style={styles.estado}>Carregando…</div>
      </Layout>
    );
  }

  return (
    <Layout titulo={condominio.nome}>
      <Link to="/condominios" style={styles.voltar}>
        ← Condomínios
      </Link>

      <header style={styles.header}>
        <div style={styles.headerLinha}>
          <h1 style={styles.titulo}>{condominio.nome}</h1>
          {podeGerenciar && (
            <Link to={`/condominios/${condominio.id}/editar`} style={styles.botaoEditar}>
              Editar
            </Link>
          )}
        </div>
        <p style={styles.subtitulo}>
          {condominio.endereco} — {condominio.bairro}, {condominio.cidade}
        </p>
        <div style={styles.metaLinha}>
          <span className="mono" style={styles.meta}>
            {condominio.cnpj || condominio.cpf}
          </span>
          <span className="mono" style={styles.meta}>
            Visita a cada {condominio.periodicidade} dias
          </span>
          {condominio.sindico && <span style={styles.meta}>Síndico: {condominio.sindico}</span>}
        </div>
      </header>

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>
          Equipamentos
          <span style={styles.contagem}>{condominio.equipamentos?.length ?? 0}</span>
          {podeGerenciar && (
            <button style={styles.botaoAdicionar} onClick={() => setMostrarFormEquip(true)}>
              + Adicionar
            </button>
          )}
        </h2>

        {(!condominio.equipamentos || condominio.equipamentos.length === 0) && (
          <div style={styles.estadoVazio}>Nenhum equipamento cadastrado ainda.</div>
        )}

        {condominio.equipamentos && condominio.equipamentos.length > 0 && (
          <div style={styles.tabela}>
            <div style={styles.linhaCabecalhoEquip}>
              <span>Local</span>
              <span>Tipo</span>
              <span>Fabricante / Modelo</span>
              <span>Nº de série</span>
              <span>Status</span>
              <span>Troca</span>
              <span></span>
            </div>
            {condominio.equipamentos.map((eq) => {
              const troca = statusTroca(eq);
              const corTroca = COR_STATUS_TROCA[troca.status];
              return (
                <div key={eq.id} style={styles.linhaEquip}>
                  <span style={styles.equipComFoto}>
                    {eq.fotoUrl && (
                      <img src={eq.fotoUrl} alt="" style={styles.miniaturaFoto} />
                    )}
                    {eq.local || '-'}
                  </span>
                  <span>{eq.tipo}</span>
                  <span>
                    {eq.fabricante} — {eq.modelo}
                  </span>
                  <span className="mono" style={styles.tdEllipsis}>
                    {eq.numeroSerie || '-'}
                  </span>
                  <span style={styles.statusLinha}>
                    <span
                      style={{
                        ...styles.statusBolinha,
                        background: eq.status === 'DEFEITO' ? 'var(--danger)' : 'var(--success)',
                      }}
                    />
                    {eq.status === 'DEFEITO' ? 'Defeito' : 'OK'}
                  </span>
                  <span>
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
                  </span>
                  {podeGerenciar ? (
                    <button
                      style={styles.botaoEditarEquip}
                      onClick={() => setEquipamentoEditando(eq)}
                    >
                      Editar
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>
          Histórico de manutenções
          <span style={styles.contagem}>{manutencoes?.length ?? 0}</span>
        </h2>

        {manutencoes === null && <div style={styles.estadoVazio}>Carregando…</div>}

        {manutencoes && manutencoes.length === 0 && (
          <div style={styles.estadoVazio}>Nenhuma visita agendada ainda para este condomínio.</div>
        )}

        {manutencoes && manutencoes.length > 0 && (
          <div style={styles.tabela}>
            <div style={styles.linhaCabecalho}>
              <span>OS</span>
              <span>Técnico</span>
              <span>Início</span>
              <span>Status</span>
            </div>
            {manutencoes.map((m) => (
              <Link key={m.id} to={`/manutencoes/${m.id}`} style={styles.linhaLink}>
                <div style={styles.linha}>
                  <span className="mono">{m.numeroOS}</span>
                  <span>{m.tecnico?.nome ?? 'Sem técnico'}</span>
                  <span className="mono">
                    {m.inicio ? new Date(m.inicio).toLocaleString('pt-BR') : '-'}
                  </span>
                  <span>
                    <StatusBadge status={m.status} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {mostrarFormEquip && id && (
        <NovoEquipamentoModal
          condominioId={id}
          onFechar={() => setMostrarFormEquip(false)}
          onCriado={() => {
            setMostrarFormEquip(false);
            carregarCondominio();
          }}
        />
      )}

      {equipamentoEditando && (
        <EditarEquipamentoModal
          equipamento={equipamentoEditando}
          onFechar={() => setEquipamentoEditando(null)}
          onSalvo={() => {
            setEquipamentoEditando(null);
            carregarCondominio();
          }}
        />
      )}
    </Layout>
  );
}

function NovoEquipamentoModal({
  condominioId,
  onFechar,
  onCriado,
}: {
  condominioId: string;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [tipo, setTipo] = useState('');
  const [local, setLocal] = useState('');
  const [status, setStatus] = useState<'OK' | 'DEFEITO'>('OK');
  const [fabricante, setFabricante] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [dataInstalacao, setDataInstalacao] = useState('');
  const [intervaloTrocaMeses, setIntervaloTrocaMeses] = useState('');
  const [dataUltimaTroca, setDataUltimaTroca] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tipo || !fabricante || !modelo || !dataInstalacao) {
      setErro('Preencha tipo, fabricante, modelo e data de instalação.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criado = await api.post<{ id: string }>('/equipamentos', {
        condominioId,
        tipo,
        local: local || undefined,
        status,
        fabricante,
        modelo,
        numeroSerie: numeroSerie || undefined,
        dataInstalacao: new Date(dataInstalacao).toISOString(),
        intervaloTrocaMeses: intervaloTrocaMeses ? Number(intervaloTrocaMeses) : undefined,
        dataUltimaTroca: dataUltimaTroca ? new Date(dataUltimaTroca).toISOString() : undefined,
      });

      if (foto) {
        const formData = new FormData();
        formData.append('arquivo', foto);
        await api.upload(`/equipamentos/${criado.id}/foto`, formData);
      }

      onCriado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar o equipamento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo equipamento" onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
        <div style={styles.campo}>
          <label style={styles.label}>Tipo *</label>
          <input
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="DVR, Câmera, Nobreak…"
            style={styles.input}
          />
        </div>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Local</label>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Portaria, Garagem…"
              style={styles.input}
            />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'OK' | 'DEFEITO')}
              style={styles.input}
            >
              <option value="OK">OK</option>
              <option value="DEFEITO">Defeito</option>
            </select>
          </div>
        </div>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Fabricante *</label>
            <input value={fabricante} onChange={(e) => setFabricante(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Modelo *</label>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} style={styles.input} />
          </div>
        </div>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Número de série</label>
            <input
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Data de instalação *</label>
            <input
              type="date"
              value={dataInstalacao}
              onChange={(e) => setDataInstalacao(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Troca a cada quantos meses?</label>
            <input
              type="number"
              min="1"
              value={intervaloTrocaMeses}
              onChange={(e) => setIntervaloTrocaMeses(e.target.value)}
              placeholder="Ex.: 12 (bateria anual)"
              style={styles.input}
            />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Data da última troca</label>
            <input
              type="date"
              value={dataUltimaTroca}
              onChange={(e) => setDataUltimaTroca(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.campo}>
          <label style={styles.label}>Foto</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            style={styles.input}
          />
        </div>
        {erro && <div style={styles.erroModal}>{erro}</div>}
        <div style={styles.acoesModal}>
          <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onFechar} style={styles.botaoCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditarEquipamentoModal({
  equipamento,
  onFechar,
  onSalvo,
}: {
  equipamento: Equipamento;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [status, setStatus] = useState<'OK' | 'DEFEITO'>(equipamento.status);
  const [numeroSerie, setNumeroSerie] = useState(equipamento.numeroSerie || '');
  const [intervaloTrocaMeses, setIntervaloTrocaMeses] = useState(
    equipamento.intervaloTrocaMeses ? String(equipamento.intervaloTrocaMeses) : '',
  );
  const [dataUltimaTroca, setDataUltimaTroca] = useState(
    equipamento.dataUltimaTroca ? equipamento.dataUltimaTroca.slice(0, 10) : '',
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/equipamentos/${equipamento.id}`, {
        status,
        numeroSerie: numeroSerie || undefined,
        intervaloTrocaMeses: intervaloTrocaMeses ? Number(intervaloTrocaMeses) : undefined,
        dataUltimaTroca: dataUltimaTroca ? new Date(dataUltimaTroca).toISOString() : undefined,
      });

      if (foto) {
        const formData = new FormData();
        formData.append('arquivo', foto);
        await api.upload(`/equipamentos/${equipamento.id}/foto`, formData);
      }

      onSalvo();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Editar - ${equipamento.tipo}`} onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'OK' | 'DEFEITO')}
              style={styles.input}
            >
              <option value="OK">OK</option>
              <option value="DEFEITO">Defeito</option>
            </select>
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Número de série</label>
            <input
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.duasColunas}>
          <div style={styles.campo}>
            <label style={styles.label}>Troca a cada quantos meses?</label>
            <input
              type="number"
              min="1"
              value={intervaloTrocaMeses}
              onChange={(e) => setIntervaloTrocaMeses(e.target.value)}
              placeholder="Ex.: 12 (bateria anual)"
              style={styles.input}
            />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Data da última troca</label>
            <input
              type="date"
              value={dataUltimaTroca}
              onChange={(e) => setDataUltimaTroca(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.campo}>
          <label style={styles.label}>Foto {equipamento.fotoUrl && '(já existe uma - escolha só se quiser trocar)'}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            style={styles.input}
          />
        </div>
        {erro && <div style={styles.erroModal}>{erro}</div>}
        <div style={styles.acoesModal}>
          <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onFechar} style={styles.botaoCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  voltar: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.85rem',
  },
  header: {
    marginTop: '0.75rem',
    marginBottom: '2rem',
  },
  headerLinha: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  botaoEditar: {
    padding: '0.4rem 0.9rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  titulo: {
    fontSize: '1.6rem',
  },
  subtitulo: {
    color: 'var(--text-muted)',
    marginTop: '0.4rem',
  },
  metaLinha: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '0.25rem 0.55rem',
    borderRadius: 4,
  },
  secao: {
    marginBottom: '2.5rem',
  },
  secaoTitulo: {
    fontSize: '1.05rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.9rem',
  },
  contagem: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  botaoAdicionar: {
    marginLeft: 'auto',
    padding: '0.35rem 0.7rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-strong)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  estadoVazio: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    padding: '1rem',
    background: 'var(--surface)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
  },
  estado: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  tabela: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  linhaCabecalho: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    padding: '0.6rem 1rem',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  linha: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    padding: '0.7rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.875rem',
    alignItems: 'center',
  },
  linhaLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  linhaCabecalhoEquip: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 1.3fr 1fr 90px 130px 70px',
    padding: '0.6rem 1rem',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  linhaEquip: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 1.3fr 1fr 90px 130px 70px',
    padding: '0.7rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.875rem',
    alignItems: 'center',
  },
  equipComFoto: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  tdEllipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  miniaturaFoto: {
    width: 28,
    height: 28,
    borderRadius: 4,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    flexShrink: 0,
  },
  statusBadgeTroca: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap',
  },
  semControle: { color: 'var(--text-muted)', fontSize: '0.85rem' },
  botaoEditarEquip: {
    padding: '0.3rem 0.6rem',
    background: 'transparent',
    color: 'var(--accent-strong)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  statusLinha: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  statusBolinha: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  campo: { display: 'flex', flexDirection: 'column', marginBottom: '0.9rem' },
  duasColunas: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  label: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' },
  input: {
    padding: '0.55rem 0.65rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.88rem',
  },
  erroModal: {
    marginTop: '0.25rem',
    marginBottom: '0.75rem',
    padding: '0.5rem 0.65rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
  },
  acoesModal: { display: 'flex', gap: '0.6rem', marginTop: '0.5rem' },
  botaoSalvar: {
    padding: '0.55rem 1.1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  botaoCancelar: {
    padding: '0.55rem 1.1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
