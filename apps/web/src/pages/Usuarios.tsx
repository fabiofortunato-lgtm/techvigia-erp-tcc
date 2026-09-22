import { useEffect, useState, CSSProperties } from 'react';
import { Layout } from '../components/Layout';
import { NovoUsuarioModal } from '../components/NovoUsuarioModal';
import { EditarUsuarioModal } from '../components/EditarUsuarioModal';
import { api, ApiError } from '../api/client';
import { Usuario } from '../api/types';
import { useAuth } from '../context/AuthContext';

const PERFIL_LABEL: Record<Usuario['perfil'], string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  TECNICO: 'Técnico',
};

export function Usuarios() {
  const { usuario: usuarioLogado } = useAuth();
  const souAdmin = usuarioLogado?.perfil === 'ADMIN';

  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  function carregar() {
    api
      .get<Usuario[]>('/usuarios')
      .then(setUsuarios)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os usuários.'));
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <Layout titulo="Usuários">
      <div style={styles.topo}>
        <p style={styles.subtitulo}>
          Todos os usuários com acesso ao sistema — painel web e app mobile.
        </p>
        {souAdmin && (
          <button style={styles.botaoNovo} onClick={() => setMostrarNovo(true)}>
            + Novo usuário
          </button>
        )}
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {!erro && usuarios === null && <div style={styles.estado}>Carregando…</div>}

      {usuarios && usuarios.length > 0 && (
        <div style={styles.tabelaWrap}>
          <table style={styles.tabela}>
            <thead>
              <tr>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>E-mail</th>
                <th style={styles.th}>Perfil</th>
                <th style={styles.th}>Status</th>
                {souAdmin && <th style={styles.th}></th>}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>{u.nome}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <span style={styles.badgePerfil}>{PERFIL_LABEL[u.perfil]}</span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badgeStatus,
                        ...(u.ativo ? styles.badgeStatusAtivo : styles.badgeStatusInativo),
                      }}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {souAdmin && (
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={styles.botaoEditar} onClick={() => setEditando(u)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarNovo && (
        <NovoUsuarioModal onFechar={() => setMostrarNovo(false)} onCriado={carregar} />
      )}

      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          onFechar={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}
    </Layout>
  );
}

const styles: Record<string, CSSProperties> = {
  topo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    gap: '1rem',
  },
  subtitulo: { color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 480 },
  botaoNovo: {
    padding: '0.6rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 700,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  erro: {
    padding: '0.75rem 1rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  tabelaWrap: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
  },
  tabela: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.85rem 1.25rem',
    borderBottom: '1px solid var(--border)',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '0.85rem 1.25rem', fontSize: '0.87rem', color: 'var(--text)' },
  badgePerfil: {
    display: 'inline-block',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--accent-strong)',
    background: 'var(--accent-soft)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.2rem 0.6rem',
  },
  badgeStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    borderRadius: 'var(--radius-pill)',
    padding: '0.2rem 0.6rem',
  },
  badgeStatusAtivo: { color: 'var(--success)', background: 'var(--success-soft)' },
  badgeStatusInativo: { color: 'var(--text-muted)', background: 'var(--bg)' },
  botaoEditar: {
    padding: '0.35rem 0.8rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
};
