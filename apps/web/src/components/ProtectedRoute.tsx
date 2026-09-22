import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { usuario, carregandoSessao } = useAuth();

  // Enquanto verifica se já existe uma sessão válida (cookie httpOnly),
  // não decide nada ainda - evita redirecionar pro login por uma fração
  // de segundo mesmo quando o usuário já está logado (ex: ao atualizar a página).
  if (carregandoSessao) {
    return null;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
