import { useState, FormEvent, CSSProperties } from 'react';
import { Modal } from './Modal';
import { api, ApiError } from '../api/client';
import { Usuario } from '../api/types';

export function EditarUsuarioModal({
  usuario,
  onFechar,
  onSalvo,
}: {
  usuario: Usuario;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [ativo, setAtivo] = useState(usuario.ativo);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.patch(`/usuarios/${usuario.id}`, { nome, email, ativo });
      onSalvo();
      onFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Editar usuário" onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
        <div style={styles.campo}>
          <label style={styles.label}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} style={styles.input} />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
        </div>

        <label style={styles.checkboxLinha}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          <span>
            Usuário ativo
            <span style={styles.checkboxAjuda}>
              {' '}
              — desmarcar impede o login, mas mantém o histórico de OS já registrado
            </span>
          </span>
        </label>

        {erro && <div style={styles.erro}>{erro}</div>}

        <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  campo: { marginBottom: '1rem', display: 'flex', flexDirection: 'column' },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
  },
  input: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  checkboxLinha: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: 'var(--text)',
    marginBottom: '1rem',
    cursor: 'pointer',
  },
  checkboxAjuda: { color: 'var(--text-muted)', fontWeight: 400 },
  erro: {
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botaoSalvar: {
    width: '100%',
    padding: '0.7rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
};
