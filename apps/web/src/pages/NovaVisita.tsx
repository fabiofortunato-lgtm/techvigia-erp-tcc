import { FormEvent, useEffect, useState, CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { Condominio, Usuario, Manutencao } from '../api/types';

export function NovaVisita() {
  const navigate = useNavigate();
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [condominioId, setCondominioId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [inicio, setInicio] = useState('');
  const [observacao, setObservacao] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Condominio[]>('/condominios').then(setCondominios).catch(() => setCondominios([]));
    api.get<Usuario[]>('/usuarios').then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!condominioId || !tecnicoId || !inicio) {
      setErro('Preencha condomínio, técnico e data/hora da visita.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const manutencao = await api.post<Manutencao>('/manutencoes', {
        condominioId,
        tecnicoId,
        inicio: new Date(inicio).toISOString(),
        observacao: observacao || undefined,
      });
      navigate(`/manutencoes/${manutencao.id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível agendar a visita.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Layout>
      <div style={styles.topo}>
        <Link to="/agenda" style={styles.voltar}>
          ← Agenda
        </Link>
        <h1 style={styles.titulo}>Agendar visita</h1>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.campo}>
          <label style={styles.label}>Condomínio *</label>
          <select
            value={condominioId}
            onChange={(e) => setCondominioId(e.target.value)}
            style={styles.input}
          >
            <option value="">Selecione…</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Técnico responsável *</label>
          <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} style={styles.input}>
            <option value="">Selecione…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.perfil})
              </option>
            ))}
          </select>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Data e hora *</label>
          <input
            type="datetime-local"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            style={styles.textarea}
            placeholder="Ex: manutenção preventiva mensal"
            rows={3}
          />
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        <div style={styles.acoes}>
          <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
            {salvando ? 'Agendando…' : 'Agendar visita'}
          </button>
          <Link to="/agenda" style={styles.botaoCancelar}>
            Cancelar
          </Link>
        </div>
      </form>
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  topo: { marginBottom: '2rem' },
  voltar: { color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' },
  titulo: { fontSize: '1.5rem', marginTop: '0.5rem' },
  form: {
    maxWidth: 480,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  campo: { display: 'flex', flexDirection: 'column', marginBottom: '1rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' },
  input: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    color: 'var(--text)',
    background: '#fff',
  },
  textarea: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    color: 'var(--text)',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  erro: {
    marginTop: '0.25rem',
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  acoes: { display: 'flex', gap: '0.75rem', marginTop: '0.5rem' },
  botaoSalvar: {
    padding: '0.7rem 1.4rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  botaoCancelar: {
    padding: '0.7rem 1.4rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
};
