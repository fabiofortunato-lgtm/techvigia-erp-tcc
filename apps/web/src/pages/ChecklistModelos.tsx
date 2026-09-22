import { useEffect, useState, CSSProperties } from 'react';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { ChecklistModelo, TipoManutencao } from '../api/types';

const TIPOS: { valor: TipoManutencao; label: string }[] = [
  { valor: 'PREVENTIVA', label: 'Preventiva' },
  { valor: 'CORRETIVA', label: 'Corretiva' },
];

export function ChecklistModelos() {
  const [modelos, setModelos] = useState<ChecklistModelo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    api
      .get<ChecklistModelo[]>('/checklist-modelos')
      .then(setModelos)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os modelos de checklist.'));
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <Layout titulo="Checklist">
      <p style={styles.explicacao}>
        Cada Tipo de OS (Preventiva ou Corretiva) tem um modelo de checklist só. Ao criar uma
        Ordem de Serviço, os itens abaixo são copiados automaticamente pro checklist dela -
        editar o modelo depois não muda nenhuma OS já criada, só as próximas.
      </p>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && modelos === null && <div style={styles.estado}>Carregando…</div>}

      {modelos !== null && (
        <div style={styles.grade}>
          {TIPOS.map((t) => {
            const modelo = modelos.find((m) => m.tipo === t.valor) ?? null;
            return (
              <CardModelo
                key={t.valor}
                tipo={t.valor}
                label={t.label}
                modelo={modelo}
                onMudou={carregar}
              />
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function CardModelo({
  tipo,
  label,
  modelo,
  onMudou,
}: {
  tipo: TipoManutencao;
  label: string;
  modelo: ChecklistModelo | null;
  onMudou: () => void;
}) {
  const [nome, setNome] = useState('');
  const [novoItem, setNovoItem] = useState('');
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState(modelo?.nome ?? '');
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [itemEdicaoTexto, setItemEdicaoTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleCriarModelo() {
    if (!nome.trim()) {
      setErro('Digite um nome pro modelo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.post('/checklist-modelos', { tipo, nome: nome.trim() });
      setNome('');
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar o modelo.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarNome() {
    if (!modelo || !nomeEdicao.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/checklist-modelos/${modelo.id}`, { nome: nomeEdicao.trim() });
      setEditandoNome(false);
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar o nome.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleAdicionarItem() {
    if (!modelo || !novoItem.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/checklist-modelos/${modelo.id}/itens`, { item: novoItem.trim() });
      setNovoItem('');
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível adicionar o item.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarItem(itemId: string) {
    if (!itemEdicaoTexto.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/checklist-modelos/itens/${itemId}`, { item: itemEdicaoTexto.trim() });
      setItemEditandoId(null);
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar o item.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemoverItem(itemId: string) {
    setSalvando(true);
    setErro(null);
    try {
      await api.delete(`/checklist-modelos/itens/${itemId}`);
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível remover o item.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardTopo}>
        <span style={styles.tipoBadge}>{label}</span>
        {modelo && !editandoNome && (
          <button
            style={styles.botaoLink}
            onClick={() => {
              setNomeEdicao(modelo.nome);
              setEditandoNome(true);
            }}
          >
            Renomear
          </button>
        )}
      </div>

      {!modelo && (
        <div style={styles.semModelo}>
          <p style={styles.semModeloTexto}>Nenhum modelo cadastrado ainda pra {label}.</p>
          <div style={styles.linhaInput}>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder='Ex.: "Checklist de CFTV Preventiva"'
              style={styles.input}
            />
            <button onClick={handleCriarModelo} disabled={salvando} style={styles.botaoPrimario}>
              Criar modelo
            </button>
          </div>
        </div>
      )}

      {modelo && (
        <>
          {editandoNome ? (
            <div style={styles.linhaInput}>
              <input
                value={nomeEdicao}
                onChange={(e) => setNomeEdicao(e.target.value)}
                style={styles.input}
              />
              <button onClick={handleSalvarNome} disabled={salvando} style={styles.botaoPrimario}>
                Salvar
              </button>
              <button onClick={() => setEditandoNome(false)} style={styles.botaoSecundario}>
                Cancelar
              </button>
            </div>
          ) : (
            <h3 style={styles.nomeModelo}>{modelo.nome}</h3>
          )}

          <div style={styles.listaItens}>
            {modelo.itens.length === 0 && (
              <div style={styles.itemVazio}>Nenhum item cadastrado ainda - adicione abaixo.</div>
            )}
            {modelo.itens.map((item) => (
              <div key={item.id} style={styles.linhaItem}>
                {itemEditandoId === item.id ? (
                  <>
                    <input
                      value={itemEdicaoTexto}
                      onChange={(e) => setItemEdicaoTexto(e.target.value)}
                      style={styles.inputItem}
                    />
                    <button
                      onClick={() => handleSalvarItem(item.id)}
                      disabled={salvando}
                      style={styles.botaoLinkPequeno}
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setItemEditandoId(null)}
                      style={styles.botaoLinkPequeno}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span style={styles.itemTexto}>{item.item}</span>
                    <button
                      onClick={() => {
                        setItemEditandoId(item.id);
                        setItemEdicaoTexto(item.item);
                      }}
                      style={styles.botaoLinkPequeno}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleRemoverItem(item.id)}
                      disabled={salvando}
                      style={styles.botaoLinkPequenoRemover}
                    >
                      Remover
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={styles.linhaInput}>
            <input
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              placeholder="Novo item do checklist…"
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleAdicionarItem()}
            />
            <button onClick={handleAdicionarItem} disabled={salvando} style={styles.botaoPrimario}>
              + Adicionar
            </button>
          </div>
        </>
      )}

      {erro && <div style={styles.erroCard}>{erro}</div>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  explicacao: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    maxWidth: 700,
    marginBottom: '1.5rem',
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  grade: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '1.25rem',
  },
  cardTopo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  tipoBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--accent-strong)',
    background: 'var(--accent-soft)',
    padding: '0.25rem 0.65rem',
    borderRadius: 'var(--radius-pill)',
  },
  nomeModelo: { fontSize: '1rem', marginBottom: '1rem' },
  semModelo: { padding: '0.5rem 0' },
  semModeloTexto: { color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '0.75rem' },
  linhaInput: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  input: {
    flex: 1,
    padding: '0.5rem 0.65rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.88rem',
  },
  inputItem: {
    flex: 1,
    padding: '0.4rem 0.55rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botaoPrimario: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  botaoSecundario: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botaoLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-strong)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  botaoLinkPequeno: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-strong)',
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  botaoLinkPequenoRemover: {
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  listaItens: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' },
  linhaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.45rem 0.6rem',
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
  },
  itemTexto: { flex: 1, fontSize: '0.85rem' },
  itemVazio: { color: 'var(--text-muted)', fontSize: '0.83rem', padding: '0.5rem 0' },
  erroCard: {
    marginTop: '0.75rem',
    padding: '0.5rem 0.65rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
  },
};
