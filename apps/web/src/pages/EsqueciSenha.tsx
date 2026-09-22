import { FormEvent, useState, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';

export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [tokenDev, setTokenDev] = useState<string | null>(null);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.post<{
        mensagem: string;
        tokenDev?: string;
        emailPreviewUrl?: string;
      }>('/auth/esqueci-senha', { email });
      setEnviado(true);
      setTokenDev(resposta.tokenDev ?? null);
      setEmailPreviewUrl(resposta.emailPreviewUrl ?? null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível processar o pedido.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.card}>
        <h1 style={styles.titulo}>Esqueci minha senha</h1>

        {!enviado ? (
          <form onSubmit={handleSubmit}>
            <p style={styles.subtitulo}>
              Informe seu e-mail cadastrado. Se ele existir em nossa base, enviaremos instruções
              para redefinir sua senha.
            </p>
            <label style={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="voce@techvigia-demo.com"
            />
            {erro && <div style={styles.erro}>{erro}</div>}
            <button type="submit" disabled={carregando} style={styles.botao}>
              {carregando ? 'Enviando…' : 'Enviar instruções'}
            </button>
          </form>
        ) : (
          <div>
            <p style={styles.subtitulo}>
              Se o e-mail <strong>{email}</strong> existir em nossa base, as instruções de
              redefinição foram geradas.
            </p>
            {tokenDev && (
              <div style={styles.avisoDev}>
                <p style={styles.avisoDevTitulo}>Modo desenvolvimento</p>
                <p style={styles.avisoDevTexto}>
                  Não há um provedor de e-mail configurado neste ambiente, então usamos uma conta
                  de teste para gerar o e-mail. Nenhum e-mail real foi enviado.
                </p>
                {emailPreviewUrl && (
                  <a
                    href={emailPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.avisoDevLink}
                  >
                    Ver o e-mail que seria enviado →
                  </a>
                )}
                <Link to={`/redefinir-senha?token=${tokenDev}`} style={styles.avisoDevLink}>
                  Ou vá direto para redefinir a senha →
                </Link>
              </div>
            )}
          </div>
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
  subtitulo: { color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' },
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
  avisoDev: {
    background: 'var(--accent-soft)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    marginBottom: '1rem',
  },
  avisoDevTitulo: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-strong)', margin: 0 },
  avisoDevTexto: { fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' },
  avisoDevLink: {
    display: 'block',
    marginTop: '0.6rem',
    color: 'var(--accent-strong)',
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
