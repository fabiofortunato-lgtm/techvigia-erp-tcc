import { FormEvent, useState, CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/techvigia-logo.png';

const RECURSOS = [
  { icone: <IconeChecklist />, texto: 'Ordens de serviço e checklist digital' },
  { icone: <IconeCaixa />, texto: 'Controle de estoque e peças' },
  { icone: <IconePessoas />, texto: 'Gestão de técnicos em campo' },
];

export function Login() {
  const { login, carregando, erro } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, senha);
      navigate('/dashboard');
    } catch {
      // erro já fica exposto via contexto (useAuth().erro)
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.painelEsquerdo}>
        <div style={styles.textura} aria-hidden="true" />

        <div style={styles.marca}>
          <img src={logo} alt="TechVigia" style={styles.logoImg} />
          <h1 style={styles.titulo}>Painel de Manutenção CFTV</h1>
          <p style={styles.subtitulo}>
            Ordem de serviço digital para condomínios.
          </p>

          <ul style={styles.listaRecursos}>
            {RECURSOS.map((r) => (
              <li key={r.texto} style={styles.itemRecurso}>
                <span style={styles.iconeRecurso}>{r.icone}</span>
                <span>{r.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={styles.painelDireito}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <h2 style={styles.cardTitulo}>Entrar</h2>
          <p style={styles.cardSubtitulo}>Acesse com seu e-mail cadastrado.</p>

          <label style={styles.label} htmlFor="email">
            E-mail
          </label>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcone}>
              <IconeEmail />
            </span>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="voce@techvigia-demo.com"
            />
          </div>

          <label style={styles.label} htmlFor="senha">
            Senha
          </label>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcone}>
              <IconeCadeado />
            </span>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {erro && <div style={styles.erro}>{erro}</div>}

          <button type="submit" disabled={carregando} style={styles.botao}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>

          <Link to="/esqueci-senha" style={styles.linkEsqueciSenha}>
            Esqueci minha senha
          </Link>
        </form>
      </div>
    </div>
  );
}

function IconeEmail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function IconeCadeado() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconeChecklist() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m9 12 2 2 4-4" />
      <path d="M8 7h8" />
    </svg>
  );
}

function IconeCaixa() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconePessoas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  pagina: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '100vh',
  },
  painelEsquerdo: {
    backgroundImage: 'linear-gradient(165deg, var(--surface-dark) 0%, var(--surface-dark-alt) 100%)',
    color: 'var(--text-on-dark)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '4rem',
    position: 'relative',
    overflow: 'hidden',
  },
  textura: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 11px)',
    pointerEvents: 'none',
  },
  marca: {
    maxWidth: 420,
    zIndex: 1,
  },
  logoImg: {
    height: 48,
    width: 'auto',
  },
  titulo: {
    fontSize: '2.1rem',
    lineHeight: 1.15,
    marginTop: '1.25rem',
    color: 'var(--text-on-dark)',
  },
  subtitulo: {
    color: 'var(--text-on-dark-muted)',
    marginTop: '0.75rem',
    lineHeight: 1.6,
  },
  listaRecursos: {
    listStyle: 'none',
    margin: '2rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  itemRecurso: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem',
    color: 'var(--text-on-dark-muted)',
  },
  iconeRecurso: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--accent-bright)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  painelDireito: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '2rem',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitulo: {
    fontSize: '1.35rem',
  },
  cardSubtitulo: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    marginTop: '0.35rem',
    marginBottom: '1.5rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
    marginTop: '0.9rem',
    color: 'var(--text-muted)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    paddingLeft: '0.75rem',
  },
  inputIcone: {
    display: 'flex',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '0.65rem 0.75rem',
    border: 'none',
    outline: 'none',
    fontSize: '0.95rem',
    color: 'var(--text)',
    background: 'transparent',
  },
  erro: {
    marginTop: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  botao: {
    marginTop: '1.75rem',
    padding: '0.75rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  linkEsqueciSenha: {
    marginTop: '1rem',
    textAlign: 'center',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
  },
};
