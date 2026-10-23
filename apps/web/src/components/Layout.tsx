import { ReactNode, CSSProperties, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DespacharOsModal } from './DespacharOsModal';
import {
  IconLayoutGrid,
  IconBuilding,
  IconClipboardList,
  IconClipboardCheck,
  IconUsers,
  IconBoxes,
  IconPackage,
  IconCamera,
  IconLogOut,
} from './icons';
import logoTransparente from '../assets/techvigia-logo.png';

const ITENS_NAV = [
  { to: '/dashboard', label: 'Dashboard', Icone: IconLayoutGrid },
  { to: '/condominios', label: 'Condomínios', Icone: IconBuilding },
  { to: '/ordens-servico', label: 'Ordens de Serviço', Icone: IconClipboardList },
  { to: '/equipamentos', label: 'Equipamentos', Icone: IconCamera },
  { to: '/checklist', label: 'Checklist', Icone: IconClipboardCheck },
  { to: '/tecnicos', label: 'Técnicos', Icone: IconUsers },
  { to: '/estoque', label: 'Estoque', Icone: IconBoxes },
  { to: '/pecas', label: 'Peças', Icone: IconPackage },
];

export function Layout({ children, titulo }: { children: ReactNode; titulo?: string }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [mostrarDespacho, setMostrarDespacho] = useState(false);

  const podeDespachar = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTextura} aria-hidden="true" />

        <div style={styles.sidebarConteudo}>
          <div style={styles.marca}>
            <img src={logoTransparente} alt="TechVigia" style={styles.logoImg} />
          </div>

          <nav style={styles.nav}>
            {ITENS_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemAtivo : {}),
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      style={{
                        ...styles.navItemBarra,
                        opacity: isActive ? 1 : 0,
                      }}
                    />
                    <item.Icone size={16} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {usuario?.perfil === 'ADMIN' && (
              <NavLink
                to="/usuarios"
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemAtivo : {}),
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      style={{
                        ...styles.navItemBarra,
                        opacity: isActive ? 1 : 0,
                      }}
                    />
                    <IconUsers size={16} />
                    <span>Usuários</span>
                  </>
                )}
              </NavLink>
            )}
          </nav>
        </div>

        <div style={styles.rodape}>
          {usuario && (
            <Link to="/minha-conta" style={styles.usuarioLink}>
              <div style={styles.usuario}>
                <div style={styles.avatar}>{usuario.email.charAt(0).toUpperCase()}</div>
                <div style={styles.usuarioTexto}>
                  <div style={styles.usuarioEmail}>{usuario.email}</div>
                  <div style={styles.badgePerfil}>{usuario.perfil}</div>
                </div>
              </div>
            </Link>
          )}
          <button onClick={handleLogout} style={styles.botaoSair}>
            <IconLogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      <div style={styles.areaPrincipal}>
        <header style={styles.topbar}>
          <h1 style={styles.topbarTitulo}>{titulo}</h1>
          {podeDespachar && (
            <button style={styles.botaoNovaOs} onClick={() => setMostrarDespacho(true)}>
              + Nova Ordem de Serviço
            </button>
          )}
        </header>

        <main style={styles.conteudo}>{children}</main>
      </div>

      {mostrarDespacho && (
        <DespacharOsModal onFechar={() => setMostrarDespacho(false)} />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    minHeight: '100vh',
  },
  sidebar: {
    position: 'relative',
    backgroundImage: 'linear-gradient(165deg, var(--surface-dark) 0%, var(--surface-dark-alt) 100%)',
    color: 'var(--text-on-dark)',
    padding: '1.5rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  sidebarTextura: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 11px)',
    pointerEvents: 'none',
  },
  sidebarConteudo: { position: 'relative' },
  marca: {
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  logoImg: {
    height: 64, maxWidth: '100%',
    width: 'auto',
  },
  areaPrincipal: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  topbar: {
    height: 72,
    background: '#fff',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    flexShrink: 0,
  },
  topbarTitulo: { fontSize: '1.15rem' },
  botaoNovaOs: {
    padding: '0.6rem 1.1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    color: 'var(--text-on-dark-muted)',
    textDecoration: 'none',
    padding: '0.55rem 0.7rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
  },
  navItemAtivo: {
    background: 'var(--surface-dark-alt)',
    color: 'var(--accent-bright)',
    fontWeight: 600,
  },
  navItemBarra: {
    position: 'absolute',
    left: -4,
    top: '20%',
    bottom: '20%',
    width: 3,
    borderRadius: 2,
    background: 'var(--accent-bright)',
  },
  rodape: {
    position: 'relative',
    borderTop: '1px solid var(--border-dark)',
    paddingTop: '1rem',
  },
  usuario: {
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  usuarioLink: {
    display: 'block',
    textDecoration: 'none',
    borderRadius: 'var(--radius)',
    marginLeft: '-0.4rem',
    marginRight: '-0.4rem',
    paddingLeft: '0.4rem',
    paddingRight: '0.4rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  usuarioTexto: {
    minWidth: 0,
  },
  usuarioEmail: {
    fontSize: '0.78rem',
    color: 'var(--text-on-dark)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgePerfil: {
    display: 'inline-block',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(18,165,148,0.35)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.1rem 0.5rem',
    marginTop: '0.2rem',
    letterSpacing: '0.02em',
  },
  botaoSair: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.5rem',
    background: 'transparent',
    color: 'var(--text-on-dark-muted)',
    border: '1px solid var(--border-dark)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  conteudo: {
    padding: '2.5rem',
    overflowY: 'auto',
  },
};
