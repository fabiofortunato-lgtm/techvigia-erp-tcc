import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { api, ApiError } from '../api/client';
import {
  Condominio,
  Usuario,
  Manutencao,
  TipoManutencao,
  PrioridadeManutencao,
} from '../api/types';

const TIPOS: { valor: TipoManutencao; label: string }[] = [
  { valor: 'PREVENTIVA', label: 'Preventiva' },
  { valor: 'CORRETIVA', label: 'Corretiva' },
];

const PRIORIDADES: { valor: PrioridadeManutencao; label: string; cor: string }[] = [
  { valor: 'BAIXA', label: 'Baixa', cor: 'var(--text-muted)' },
  { valor: 'MEDIA', label: 'Média', cor: 'var(--warning)' },
  { valor: 'ALTA', label: 'Alta', cor: 'var(--danger)' },
];

export function DespacharOsModal({ onFechar }: { onFechar: () => void }) {
  const navigate = useNavigate();
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [condominioId, setCondominioId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [tipo, setTipo] = useState<TipoManutencao>('PREVENTIVA');
  const [prioridade, setPrioridade] = useState<PrioridadeManutencao>('MEDIA');
  const [dataAgendada, setDataAgendada] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Condominio[]>('/condominios').then(setCondominios).catch(() => setCondominios([]));
    api.get<Usuario[]>('/usuarios').then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  const podeDespachar = !!condominioId && !!tecnicoId && !!dataAgendada;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeDespachar) return;

    setSalvando(true);
    setErro(null);
    try {
      const manutencao = await api.post<Manutencao>('/manutencoes', {
        condominioId,
        tecnicoId,
        inicio: new Date(dataAgendada).toISOString(),
        tipo,
        prioridade,
      });
      onFechar();
      navigate(`/manutencoes/${manutencao.id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível despachar a ordem.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Despachar Ordem de Serviço" onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
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
          <label style={styles.label}>Técnico *</label>
          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            style={styles.input}
          >
            <option value="">Selecione…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.perfil})
              </option>
            ))}
          </select>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Tipo</label>
          <div style={styles.toggleLinha}>
            {TIPOS.map((t) => (
              <button
                type="button"
                key={t.valor}
                onClick={() => setTipo(t.valor)}
                style={{ ...styles.toggleBotao, ...(tipo === t.valor ? styles.toggleBotaoAtivo : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Prioridade</label>
          <div style={styles.toggleLinha}>
            {PRIORIDADES.map((p) => (
              <button
                type="button"
                key={p.valor}
                onClick={() => setPrioridade(p.valor)}
                style={{
                  ...styles.toggleBotao,
                  ...(prioridade === p.valor
                    ? { ...styles.toggleBotaoAtivo, color: p.cor, borderColor: p.cor }
                    : {}),
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Data agendada *</label>
          <input
            type="datetime-local"
            value={dataAgendada}
            onChange={(e) => setDataAgendada(e.target.value)}
            style={styles.input}
          />
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        <div style={styles.acoes}>
          <button
            type="submit"
            disabled={!podeDespachar || salvando}
            style={{ ...styles.botaoSalvar, ...(!podeDespachar ? styles.botaoDesabilitado : {}) }}
          >
            {salvando ? 'Despachando…' : 'Despachar Ordem'}
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
  campo: { display: 'flex', flexDirection: 'column', marginBottom: '1rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' },
  input: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    background: '#fff',
  },
  toggleLinha: { display: 'flex', gap: '0.5rem' },
  toggleBotao: {
    flex: 1,
    padding: '0.55rem',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: '#fff',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  toggleBotaoAtivo: {
    background: 'var(--surface-dark)',
    color: '#fff',
    borderColor: 'var(--surface-dark)',
  },
  erro: {
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  acoes: { display: 'flex', gap: '0.6rem', marginTop: '0.5rem' },
  botaoSalvar: {
    flex: 1,
    padding: '0.7rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  botaoDesabilitado: { background: '#cbd5e1', color: '#94a3b8', cursor: 'not-allowed' },
  botaoCancelar: {
    padding: '0.7rem 1.1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
};
