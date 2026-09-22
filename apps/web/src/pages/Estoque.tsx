import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { api, ApiError } from '../api/client';
import { ItemEstoque } from '../api/types';
import { useAuth } from '../context/AuthContext';

export function Estoque() {
  const { usuario } = useAuth();
  const podeGerenciar = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  const [itens, setItens] = useState<ItemEstoque[] | null>(null);
  const [alertas, setAlertas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [itemMovimentando, setItemMovimentando] = useState<ItemEstoque | null>(null);

  function carregar() {
    api
      .get<ItemEstoque[]>('/estoque')
      .then(setItens)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar o estoque.'));

    api
      .get<ItemEstoque[]>('/estoque/alertas/abaixo-do-minimo')
      .then((lista) => setAlertas(new Set(lista.map((i) => i.id))))
      .catch(() => setAlertas(new Set()));
  }

  useEffect(carregar, []);

  return (
    <Layout titulo="Estoque">
      <header style={styles.header}>
        <div>
          <h1 style={styles.titulo}>Estoque</h1>
          <p style={styles.subtitulo}>{itens ? `${itens.length} item(ns)` : 'Carregando…'}</p>
        </div>
        {podeGerenciar && (
          <button style={styles.botaoNovo} onClick={() => setMostrarForm(true)}>
            + Novo item
          </button>
        )}
      </header>

      {erro && <div style={styles.erro}>{erro}</div>}

      {itens && itens.length === 0 && (
        <div style={styles.estado}>Nenhum item cadastrado no estoque ainda.</div>
      )}

      {itens && itens.length > 0 && (
        <div style={styles.tabela}>
          <div style={styles.linhaCabecalho}>
            <span>Item</span>
            <span>Saldo</span>
            <span>Mínimo</span>
            <span>Fornecedor</span>
            {podeGerenciar && <span>Ação</span>}
          </div>
          {itens.map((item) => {
            const abaixoDoMinimo = alertas.has(item.id);
            return (
              <div key={item.id} style={styles.linha}>
                <span>{item.nome}</span>
                <span className="mono" style={abaixoDoMinimo ? styles.saldoBaixo : undefined}>
                  {item.quantidade} {item.unidade}
                  {abaixoDoMinimo && <span style={styles.tagAlerta}>repor</span>}
                </span>
                <span className="mono">
                  {item.quantidadeMinima} {item.unidade}
                </span>
                <span>{item.fornecedor || '-'}</span>
                {podeGerenciar && (
                  <span>
                    <button style={styles.botaoMovimentar} onClick={() => setItemMovimentando(item)}>
                      Movimentar
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mostrarForm && (
        <NovoItemModal
          onFechar={() => setMostrarForm(false)}
          onCriado={() => {
            setMostrarForm(false);
            carregar();
          }}
        />
      )}

      {itemMovimentando && (
        <MovimentarModal
          item={itemMovimentando}
          onFechar={() => setItemMovimentando(null)}
          onMovimentado={() => {
            setItemMovimentando(null);
            carregar();
          }}
        />
      )}
    </Layout>
  );
}

function NovoItemModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [quantidade, setQuantidade] = useState('0');
  const [quantidadeMinima, setQuantidadeMinima] = useState('0');
  const [fornecedor, setFornecedor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome do item.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.post('/estoque', {
        nome,
        unidade,
        quantidade: Number(quantidade) || 0,
        quantidadeMinima: Number(quantidadeMinima) || 0,
        fornecedor: fornecedor || undefined,
      });
      onCriado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar o item.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo item de estoque" onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
        <CampoTexto label="Nome *" valor={nome} onChange={setNome} />
        <div style={styles.duasColunas}>
          <CampoTexto label="Unidade" valor={unidade} onChange={setUnidade} placeholder="un, m, cx…" />
          <CampoTexto label="Fornecedor" valor={fornecedor} onChange={setFornecedor} />
        </div>
        <div style={styles.duasColunas}>
          <CampoTexto label="Saldo inicial" valor={quantidade} onChange={setQuantidade} tipo="number" />
          <CampoTexto
            label="Estoque mínimo"
            valor={quantidadeMinima}
            onChange={setQuantidadeMinima}
            tipo="number"
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

function MovimentarModal({
  item,
  onFechar,
  onMovimentado,
}: {
  item: ItemEstoque;
  onFechar: () => void;
  onMovimentado: () => void;
}) {
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA');
  const [quantidade, setQuantidade] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/estoque/${item.id}/movimentacoes`, {
        tipo,
        quantidade: Number(quantidade) || 0,
        motivo: motivo || undefined,
      });
      onMovimentado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar a movimentação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Movimentar: ${item.nome}`} onFechar={onFechar}>
      <p style={styles.saldoAtual}>
        Saldo atual: <strong className="mono">{item.quantidade} {item.unidade}</strong>
      </p>
      <form onSubmit={handleSubmit}>
        <div style={styles.tipoBotoes}>
          <button
            type="button"
            onClick={() => setTipo('ENTRADA')}
            style={{ ...styles.tipoBotao, ...(tipo === 'ENTRADA' ? styles.tipoBotaoAtivo : {}) }}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setTipo('SAIDA')}
            style={{ ...styles.tipoBotao, ...(tipo === 'SAIDA' ? styles.tipoBotaoAtivoSaida : {}) }}
          >
            Saída
          </button>
        </div>
        <CampoTexto label="Quantidade" valor={quantidade} onChange={setQuantidade} tipo="number" />
        <CampoTexto label="Motivo" valor={motivo} onChange={setMotivo} placeholder="Uso em OS, reposição…" />
        {erro && <div style={styles.erroModal}>{erro}</div>}
        <div style={styles.acoesModal}>
          <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
            {salvando ? 'Salvando…' : 'Confirmar'}
          </button>
          <button type="button" onClick={onFechar} style={styles.botaoCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CampoTexto({
  label,
  valor,
  onChange,
  tipo = 'text',
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  placeholder?: string;
}) {
  return (
    <div style={styles.campo}>
      <label style={styles.label}>{label}</label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '2rem',
  },
  titulo: { fontSize: '1.5rem' },
  subtitulo: { color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' },
  botaoNovo: {
    padding: '0.6rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' },
  tabela: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  linhaCabecalho: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 0.8fr',
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
    gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 0.8fr',
    padding: '0.7rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.875rem',
    alignItems: 'center',
  },
  saldoBaixo: { color: 'var(--danger)', fontWeight: 600 },
  tagAlerta: {
    marginLeft: '0.5rem',
    fontSize: '0.65rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: '0.1rem 0.4rem',
    borderRadius: 4,
  },
  botaoMovimentar: {
    padding: '0.35rem 0.65rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: '0.78rem',
    color: 'var(--text)',
  },
  saldoAtual: { fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' },
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
  tipoBotoes: { display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' },
  tipoBotao: {
    flex: 1,
    padding: '0.5rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  tipoBotaoAtivo: {
    background: '#e5f6ee',
    borderColor: 'var(--success)',
    color: 'var(--success)',
    fontWeight: 600,
  },
  tipoBotaoAtivoSaida: {
    background: 'var(--danger-soft)',
    borderColor: 'var(--danger)',
    color: 'var(--danger)',
    fontWeight: 600,
  },
};
