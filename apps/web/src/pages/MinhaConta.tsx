import { useState, FormEvent, CSSProperties } from 'react';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function MinhaConta() {
  const { usuario, atualizarUsuarioLogado } = useAuth();

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const [sucessoPerfil, setSucessoPerfil] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState(false);

  async function handleSalvarPerfil(e: FormEvent) {
    e.preventDefault();
    setSalvandoPerfil(true);
    setErroPerfil(null);
    setSucessoPerfil(false);
    try {
      const atualizado = await api.patch<{ nome: string; email: string }>('/auth/me', {
        nome,
        email,
      });
      atualizarUsuarioLogado(atualizado);
      setSucessoPerfil(true);
    } catch (e) {
      setErroPerfil(e instanceof ApiError ? e.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function handleTrocarSenha(e: FormEvent) {
    e.preventDefault();
    setSalvandoSenha(true);
    setErroSenha(null);
    setSucessoSenha(false);
    try {
      await api.post('/auth/trocar-senha', { senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setSucessoSenha(true);
    } catch (e) {
      setErroSenha(e instanceof ApiError ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <Layout titulo="Minha conta">
      <div style={styles.grid}>
        <form onSubmit={handleSalvarPerfil} style={styles.card}>
          <h2 style={styles.cardTitulo}>Meus dados</h2>

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

          <div style={styles.campo}>
            <label style={styles.label}>Perfil de acesso</label>
            <input value={usuario?.perfil ?? ''} disabled style={styles.inputDesabilitado} />
            <span style={styles.ajuda}>Só um administrador pode alterar seu perfil de acesso.</span>
          </div>

          {erroPerfil && <div style={styles.erro}>{erroPerfil}</div>}
          {sucessoPerfil && <div style={styles.sucesso}>Dados atualizados com sucesso.</div>}

          <button type="submit" disabled={salvandoPerfil} style={styles.botaoSalvar}>
            {salvandoPerfil ? 'Salvando…' : 'Salvar dados'}
          </button>
        </form>

        <form onSubmit={handleTrocarSenha} style={styles.card}>
          <h2 style={styles.cardTitulo}>Trocar senha</h2>

          <div style={styles.campo}>
            <label style={styles.label}>Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Nova senha (mín. 8 caracteres)</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              style={styles.input}
            />
          </div>

          {erroSenha && <div style={styles.erro}>{erroSenha}</div>}
          {sucessoSenha && <div style={styles.sucesso}>Senha alterada com sucesso.</div>}

          <button
            type="submit"
            disabled={salvandoSenha || !senhaAtual || novaSenha.length < 8}
            style={styles.botaoSalvar}
          >
            {salvandoSenha ? 'Trocando…' : 'Trocar senha'}
          </button>
        </form>
      </div>
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    maxWidth: 900,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '1.5rem',
  },
  cardTitulo: { fontSize: '1rem', marginBottom: '1.25rem' },
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
  inputDesabilitado: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
  },
  ajuda: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' },
  erro: {
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  sucesso: {
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--success-soft)',
    color: 'var(--success)',
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
