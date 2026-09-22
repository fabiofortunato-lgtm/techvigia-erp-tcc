import { useState, FormEvent, CSSProperties } from 'react';
import { Modal } from './Modal';
import { api, ApiError } from '../api/client';
import { Usuario } from '../api/types';

const PERFIS: { valor: Usuario['perfil']; label: string; descricao: string }[] = [
  { valor: 'TECNICO', label: 'Técnico', descricao: 'Executa as visitas em campo pelo app' },
  { valor: 'GESTOR', label: 'Gestor', descricao: 'Administra o dia a dia, sem gerenciar usuários' },
  { valor: 'ADMIN', label: 'Administrador', descricao: 'Acesso completo, incluindo cadastro de usuários' },
];

export function NovoUsuarioModal({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<Usuario['perfil']>('TECNICO');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const podeCriar = !!nome.trim() && !!email.trim() && senha.length >= 8;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeCriar) return;

    setSalvando(true);
    setErro(null);
    try {
      await api.post('/usuarios', { nome, email, senha, perfil });
      onCriado();
      onFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo usuário" onFechar={onFechar}>
      <form onSubmit={handleSubmit}>
        <div style={styles.campo}>
          <label style={styles.label}>Nome *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={styles.input}
            placeholder="Nome completo"
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>E-mail *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="pessoa@techvigia-demo.com"
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Senha provisória * (mín. 8 caracteres)</label>
          <input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={styles.input}
            placeholder="A pessoa pode trocar depois em Esqueci minha senha"
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Perfil *</label>
          <div style={styles.perfilOpcoes}>
            {PERFIS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPerfil(p.valor)}
                style={{
                  ...styles.perfilBotao,
                  ...(perfil === p.valor ? styles.perfilBotaoAtivo : {}),
                }}
              >
                <span style={styles.perfilLabel}>{p.label}</span>
                <span style={styles.perfilDescricao}>{p.descricao}</span>
              </button>
            ))}
          </div>
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        <button type="submit" disabled={!podeCriar || salvando} style={styles.botaoSalvar}>
          {salvando ? 'Criando…' : 'Criar usuário'}
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
  perfilOpcoes: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  perfilBotao: {
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--surface)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  perfilBotaoAtivo: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  perfilLabel: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)' },
  perfilDescricao: { fontSize: '0.75rem', color: 'var(--text-muted)' },
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
