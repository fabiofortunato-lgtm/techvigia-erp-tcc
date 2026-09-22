import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { Dashboard } from './pages/Dashboard';
import { Condominios } from './pages/Condominios';
import { CondominioDetalhe } from './pages/CondominioDetalhe';
import { NovoCondominio } from './pages/NovoCondominio';
import { EditarCondominio } from './pages/EditarCondominio';
import { OrdensServico } from './pages/OrdensServico';
import { Tecnicos } from './pages/Tecnicos';
import { Usuarios } from './pages/Usuarios';
import { MinhaConta } from './pages/MinhaConta';
import { Pecas } from './pages/Pecas';
import { Estoque } from './pages/Estoque';
import { Equipamentos } from './pages/Equipamentos';
import { ChecklistModelos } from './pages/ChecklistModelos';
import { ManutencaoDetalhe } from './pages/ManutencaoDetalhe';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/condominios"
            element={
              <ProtectedRoute>
                <Condominios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/condominios/novo"
            element={
              <ProtectedRoute>
                <NovoCondominio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/condominios/:id/editar"
            element={
              <ProtectedRoute>
                <EditarCondominio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/condominios/:id"
            element={
              <ProtectedRoute>
                <CondominioDetalhe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ordens-servico"
            element={
              <ProtectedRoute>
                <OrdensServico />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tecnicos"
            element={
              <ProtectedRoute>
                <Tecnicos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <Usuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/minha-conta"
            element={
              <ProtectedRoute>
                <MinhaConta />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pecas"
            element={
              <ProtectedRoute>
                <Pecas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque"
            element={
              <ProtectedRoute>
                <Estoque />
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipamentos"
            element={
              <ProtectedRoute>
                <Equipamentos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checklist"
            element={
              <ProtectedRoute>
                <ChecklistModelos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manutencoes/:id"
            element={
              <ProtectedRoute>
                <ManutencaoDetalhe />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
