import { FormEvent, useState, CSSProperties } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';

export function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha });
      setSucesso(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível redefinir a senha.');
    } finally {
      setCarregando(false);
    }
  }

  if (!token) {
    return (
      <div style={styles.pagina}>
        <div style={styles.card}>
          <h1 style={styles.titulo}>Link inválido</h1>
          <p style={styles.subtitulo}>
            Este link de redefinição está incompleto. Solicite um novo link na tela de login.
          </p>
          <Link to="/esqueci-senha" style={styles.botaoLink}>
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.card}>
        <h1 style={styles.titulo}>Redefinir senha</h1>

        {sucesso ? (
          <p style={styles.subtitulo}>
            ✓ Senha redefinida com sucesso. Você será redirecionado para o login…
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={styles.label} htmlFor="novaSenha">
              Nova senha
            </label>
            <input
              id="novaSenha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              style={styles.input}
              placeholder="Mínimo 8 caracteres"
            />

            <label style={styles.label} htmlFor="confirmacao">
              Confirmar nova senha
            </label>
            <input
              id="confirmacao"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              style={styles.input}
            />

            {erro && <div style={styles.erro}>{erro}</div>}

            <button type="submit" disabled={carregando} style={styles.botao}>
              {carregando ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <Link to="/login" style={styles.voltar}>
          ← Voltar para o login
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '2rem',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '2rem',
  },
  titulo: { fontSize: '1.3rem', marginBottom: '0.75rem' },
  subtitulo: { color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' },
  input: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.95rem',
    marginBottom: '1rem',
    boxSizing: 'border-box',
  },
  erro: {
    marginBottom: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botao: {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  botaoLink: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.65rem 1.1rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  voltar: {
    display: 'block',
    marginTop: '1.5rem',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    textDecoration: 'none',
  },
};
