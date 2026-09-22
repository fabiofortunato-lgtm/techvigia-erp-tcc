import React, { useEffect, useRef, useState, CSSProperties, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { api, ApiError } from '../api/client';
import {
  ManutencaoDetalhe as ManutencaoDetalheType,
  StatusChecklistItem,
  Foto,
  TipoFoto,
  Usuario,
} from '../api/types';

export function ManutencaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [manutencao, setManutencao] = useState<ManutencaoDetalheType | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [tecnicoParaAtribuir, setTecnicoParaAtribuir] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);

  function carregar() {
    if (!id) return;
    api
      .get<ManutencaoDetalheType>(`/manutencoes/${id}`)
      .then(setManutencao)
      .catch((e: ApiError) => setErro(e.message || 'Manutenção não encontrada.'));
  }

  useEffect(carregar, [id]);

  useEffect(() => {
    api.get<Usuario[]>('/usuarios').then(setTecnicos).catch(() => setTecnicos([]));
  }, []);

  async function handleAtribuirTecnico() {
    if (!id || !tecnicoParaAtribuir) return;
    setAtribuindo(true);
    setErro(null);
    try {
      await api.put(`/manutencoes/${id}`, { tecnicoId: tecnicoParaAtribuir });
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível atribuir o técnico.');
    } finally {
      setAtribuindo(false);
    }
  }

  async function handleGerarPdf() {
    if (!id) return;
    setGerandoPdf(true);
    setErro(null);
    try {
      await api.post(`/manutencoes/${id}/gerar-pdf`);
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  if (erro && !manutencao) {
    return (
      <Layout titulo="Ordem de Serviço">
        <div style={styles.erro}>{erro}</div>
      </Layout>
    );
  }

  if (!manutencao) {
    return (
      <Layout titulo="Ordem de Serviço">
        <div style={styles.estado}>Carregando…</div>
      </Layout>
    );
  }

  const podeGerarPdf = !!manutencao.assinaturaUrl && manutencao.status !== 'CONCLUIDA';

  return (
    <Layout titulo="Ordem de Serviço">
      <Link to={`/condominios/${manutencao.condominio.id}`} style={styles.voltar}>
        ← {manutencao.condominio.nome}
      </Link>

      <header style={styles.header}>
        <div>
          <h1 style={styles.titulo} className="mono">
            {manutencao.numeroOS}
          </h1>
          <p style={styles.subtitulo}>
            {manutencao.tecnico?.nome ?? 'Sem técnico atribuído'} ·{' '}
            {manutencao.inicio ? new Date(manutencao.inicio).toLocaleString('pt-BR') : 'sem data'}
          </p>
        </div>
        <StatusBadge status={manutencao.status} />
      </header>

      {manutencao.latitudeCheckin != null && manutencao.longitudeCheckin != null && (
        <p style={styles.checkinInfo}>
          📍 Check-in feito em{' '}
          <a
            href={`https://www.google.com/maps?q=${manutencao.latitudeCheckin},${manutencao.longitudeCheckin}`}
            target="_blank"
            rel="noreferrer"
            style={styles.checkinLink}
          >
            {manutencao.latitudeCheckin.toFixed(5)}, {manutencao.longitudeCheckin.toFixed(5)}
          </a>
        </p>
      )}

      {!manutencao.tecnico && (
        <div style={styles.avisoAtribuir}>
          <p style={styles.avisoAtribuirTexto}>
            ⚠️ Esta OS foi gerada automaticamente e ainda não tem um técnico atribuído. Escolha
            um abaixo pra liberar o atendimento.
          </p>
          <div style={styles.avisoAtribuirForm}>
            <select
              value={tecnicoParaAtribuir}
              onChange={(e) => setTecnicoParaAtribuir(e.target.value)}
              style={styles.avisoAtribuirSelect}
            >
              <option value="">Selecione um técnico…</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button
              onClick={handleAtribuirTecnico}
              disabled={!tecnicoParaAtribuir || atribuindo}
              style={styles.avisoAtribuirBotao}
            >
              {atribuindo ? 'Atribuindo…' : 'Atribuir técnico'}
            </button>
          </div>
        </div>
      )}

      {erro && <div style={styles.erro}>{erro}</div>}

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>Checklist</h2>
        <ChecklistSecao
          manutencaoId={manutencao.id}
          itens={manutencao.checklist}
          onAtualizado={carregar}
        />
      </section>

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>Fotos</h2>
        <FotosSecao manutencaoId={manutencao.id} fotos={manutencao.fotos} onAtualizado={carregar} />
      </section>

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>Assinatura</h2>
        {manutencao.assinaturaUrl ? (
          <div style={styles.assinaturaColetada}>
            <img src={manutencao.assinaturaUrl} alt="Assinatura coletada" style={styles.assinaturaImg} />
            <span style={styles.assinaturaOk}>✓ Assinatura coletada</span>
          </div>
        ) : (
          <AssinaturaCanvas manutencaoId={manutencao.id} onSalva={carregar} />
        )}
      </section>

      <section style={styles.secao}>
        <h2 style={styles.secaoTitulo}>Ordem de Serviço</h2>
        {manutencao.pdfUrl ? (
          <a href={manutencao.pdfUrl} target="_blank" rel="noreferrer" style={styles.linkPdf}>
            📄 Abrir PDF da OS
          </a>
        ) : (
          <div>
            <button
              onClick={handleGerarPdf}
              disabled={!podeGerarPdf || gerandoPdf}
              style={{
                ...styles.botaoGerarPdf,
                ...(!podeGerarPdf ? styles.botaoDesabilitado : {}),
              }}
            >
              {gerandoPdf ? 'Gerando…' : 'Gerar PDF e fechar OS'}
            </button>
            {!manutencao.assinaturaUrl && (
              <p style={styles.avisoPdf}>Colete a assinatura antes de gerar o PDF.</p>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}

function ChecklistSecao({
  manutencaoId,
  itens,
  onAtualizado,
}: {
  manutencaoId: string;
  itens: { id: string; item: string; status: StatusChecklistItem; observacao?: string | null }[];
  onAtualizado: () => void;
}) {
  const [item, setItem] = useState('');
  const [status, setStatus] = useState<StatusChecklistItem>('OK');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/manutencoes/${manutencaoId}/checklist`, { item, status });
      setItem('');
      setStatus('OK');
      onAtualizado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível adicionar o item.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      {itens.length === 0 ? (
        <div style={styles.estadoVazio}>Nenhum item registrado ainda.</div>
      ) : (
        <div style={styles.listaChecklist}>
          {itens.map((i) => (
            <div key={i.id} style={styles.checklistItem}>
              <span style={i.status === 'DEFEITO' ? styles.checklistDefeito : styles.checklistOk}>
                {i.status === 'OK' ? '✓' : i.status === 'DEFEITO' ? '✕' : '–'}
              </span>
              <span>{i.item}</span>
              {i.observacao && <span style={styles.checklistObs}>({i.observacao})</span>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.formChecklist}>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Ex: DVR ligando normalmente"
          style={styles.inputChecklist}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusChecklistItem)}
          style={styles.selectChecklist}
        >
          <option value="OK">OK</option>
          <option value="DEFEITO">Defeito</option>
          <option value="NAO_APLICAVEL">N/A</option>
        </select>
        <button type="submit" disabled={salvando} style={styles.botaoAdicionarChecklist}>
          + Item
        </button>
      </form>
      {erro && <div style={styles.erroPequeno}>{erro}</div>}
    </div>
  );
}

function FotosSecao({
  manutencaoId,
  fotos,
  onAtualizado,
}: {
  manutencaoId: string;
  fotos: Foto[];
  onAtualizado: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoFoto>('ANTES');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fotosAntes = fotos.filter((f) => f.tipo === 'ANTES');
  const fotosDepois = fotos.filter((f) => f.tipo === 'DEPOIS');

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('tipo', tipo);
      await api.upload(`/manutencoes/${manutencaoId}/fotos`, formData);
      onAtualizado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      {fotos.length === 0 ? (
        <div style={styles.estadoVazio}>Nenhuma foto enviada ainda.</div>
      ) : (
        <div style={styles.fotosGrupos}>
          <FotosGaleria titulo="Antes" fotos={fotosAntes} />
          <FotosGaleria titulo="Depois" fotos={fotosDepois} />
        </div>
      )}

      <div style={styles.uploadLinha}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFoto)} style={styles.selectChecklist}>
          <option value="ANTES">Antes</option>
          <option value="DEPOIS">Depois</option>
        </select>
        <label style={styles.botaoUpload}>
          {enviando ? 'Enviando…' : '+ Enviar foto'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleArquivoSelecionado}
            disabled={enviando}
            style={styles.inputArquivoOculto}
          />
        </label>
      </div>
      {erro && <div style={styles.erroPequeno}>{erro}</div>}
    </div>
  );
}

function FotosGaleria({ titulo, fotos }: { titulo: string; fotos: Foto[] }) {
  if (fotos.length === 0) return null;

  return (
    <div>
      <p style={styles.fotosGrupoTitulo}>
        {titulo} <span style={styles.contagem}>{fotos.length}</span>
      </p>
      <div style={styles.fotosGrid}>
        {fotos.map((f) => (
          <a key={f.id} href={f.arquivoUrl} target="_blank" rel="noreferrer">
            <img src={f.arquivoUrl} alt={titulo} style={styles.fotoThumb} />
          </a>
        ))}
      </div>
    </div>
  );
}

function AssinaturaCanvas({
  manutencaoId,
  onSalva,
}: {
  manutencaoId: string;
  onSalva: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function posicao(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ponto = 'touches' in e ? e.touches[0] : e;
    return { x: ponto.clientX - rect.left, y: ponto.clientY - rect.top };
  }

  function iniciarTraco(e: React.MouseEvent | React.TouchEvent) {
    desenhando.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function continuarTraco(e: React.MouseEvent | React.TouchEvent) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#151a21';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setTemTraco(true);
  }

  function finalizarTraco() {
    desenhando.current = false;
  }

  function limpar() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  }

  async function salvar() {
    if (!temTraco) {
      setErro('Colete a assinatura no quadro antes de salvar.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const imagemBase64 = canvasRef.current!.toDataURL('image/png');
      await api.post(`/manutencoes/${manutencaoId}/assinatura`, { imagemBase64 });
      onSalva();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar a assinatura.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        style={styles.canvas}
        onMouseDown={iniciarTraco}
        onMouseMove={continuarTraco}
        onMouseUp={finalizarTraco}
        onMouseLeave={finalizarTraco}
        onTouchStart={iniciarTraco}
        onTouchMove={continuarTraco}
        onTouchEnd={finalizarTraco}
      />
      <p style={styles.canvasDica}>Assine com o mouse ou o dedo (touch) dentro do quadro acima.</p>
      {erro && <div style={styles.erroPequeno}>{erro}</div>}
      <div style={styles.acoesAssinatura}>
        <button onClick={salvar} disabled={salvando} style={styles.botaoSalvarAssinatura}>
          {salvando ? 'Salvando…' : 'Salvar assinatura'}
        </button>
        <button onClick={limpar} style={styles.botaoLimpar} type="button">
          Limpar
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  checkinInfo: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
  },
  checkinLink: {
    color: 'var(--accent-strong)',
    textDecoration: 'underline',
  },
  avisoAtribuir: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    padding: '0.9rem 1rem',
    background: 'var(--warning-soft)',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-card)',
    marginBottom: '1.25rem',
  },
  avisoAtribuirTexto: { margin: 0, fontSize: '0.88rem', color: 'var(--text)' },
  avisoAtribuirForm: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  avisoAtribuirSelect: {
    flex: 1,
    minWidth: 220,
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  avisoAtribuirBotao: {
    padding: '0.5rem 1.1rem',
    background: 'var(--accent-strong)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  voltar: { color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: '0.75rem',
    marginBottom: '2rem',
  },
  titulo: { fontSize: '1.4rem' },
  subtitulo: { color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem' },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
  erroPequeno: {
    marginTop: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--danger)',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  estadoVazio: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    padding: '0.9rem',
    background: 'var(--surface)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: '0.9rem',
  },
  secao: { marginBottom: '2.25rem', maxWidth: 560 },
  secaoTitulo: { fontSize: '1.02rem', marginBottom: '0.9rem' },
  listaChecklist: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: '0.9rem',
    overflow: 'hidden',
  },
  checklistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.6rem 0.9rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.88rem',
  },
  checklistOk: { color: 'var(--success)', fontWeight: 700 },
  checklistDefeito: { color: 'var(--danger)', fontWeight: 700 },
  checklistObs: { color: 'var(--text-muted)', fontSize: '0.8rem' },
  formChecklist: { display: 'flex', gap: '0.5rem' },
  inputChecklist: {
    flex: 1,
    padding: '0.55rem 0.65rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  selectChecklist: {
    padding: '0.55rem 0.5rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botaoAdicionarChecklist: {
    padding: '0.55rem 0.9rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  fotosGrupos: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' },
  fotosGrupoTitulo: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  },
  contagem: { fontWeight: 400, color: 'var(--text-muted)' },
  fotosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: '0.5rem',
  },
  fotoThumb: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  uploadLinha: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  botaoUpload: {
    padding: '0.55rem 0.9rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  inputArquivoOculto: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  canvas: {
    background: '#fff',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    touchAction: 'none',
    cursor: 'crosshair',
  },
  canvasDica: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' },
  acoesAssinatura: { display: 'flex', gap: '0.6rem', marginTop: '0.7rem' },
  botaoSalvarAssinatura: {
    padding: '0.55rem 1.1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  botaoLimpar: {
    padding: '0.55rem 1.1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  assinaturaColetada: { display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-start' },
  assinaturaImg: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    maxWidth: 300,
  },
  assinaturaOk: { fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 },
  linkPdf: {
    display: 'inline-block',
    padding: '0.6rem 1rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-strong)',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  botaoGerarPdf: {
    padding: '0.65rem 1.2rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  botaoDesabilitado: {
    background: 'var(--border)',
    color: 'var(--text-muted)',
  },
  avisoPdf: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' },
};
