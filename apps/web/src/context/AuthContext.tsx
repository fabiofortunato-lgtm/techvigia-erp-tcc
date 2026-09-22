import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import { LoginResponse, UsuarioLogado } from '../api/types';

interface AuthContextValue {
  usuario: UsuarioLogado | null;
  carregandoSessao: boolean;
  carregando: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  // Atualiza só os campos informados no usuário logado em memória - usado
  // depois de PATCH /auth/me, pra sidebar refletir nome/e-mail novos sem
  // precisar de um reload da página inteira.
  atualizarUsuarioLogado: (dados: Partial<UsuarioLogado>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O token agora vive só no cookie httpOnly (nunca acessível via JS) -
  // então, ao carregar o app, a única forma de saber se já existe uma
  // sessão válida é perguntar ao backend (o cookie é enviado automaticamente
  // pelo navegador, sem precisarmos ler nada aqui).
  useEffect(() => {
    // Limpeza única: navegadores que já usaram a versão anterior (antes do
    // cookie httpOnly) ainda têm o token salvo em localStorage. O código
    // atual não lê mais esses valores, mas é higiene de segurança deixá-los
    // órfãos por ali - melhor remover na primeira vez que o app novo carrega.
    localStorage.removeItem('scantech_access_token');
    localStorage.removeItem('scantech_refresh_token');

    api
      .get<UsuarioLogado | null>('/auth/me')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCarregandoSessao(false));
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.post<LoginResponse>('/auth/login', { email, senha });
      // O accessToken/refreshToken da resposta são ignorados de propósito -
      // o backend já os colocou em cookies httpOnly; guardar em variável ou
      // state aqui reabriria a mesma exposição a XSS que o cookie evita.
      setUsuario(resposta.usuario);
    } catch (e) {
      // Antes, qualquer falha aqui (senha errada, rate limit, sem conexão,
      // erro do servidor) mostrava sempre "E-mail ou senha incorretos" -
      // enganoso quando o problema real era outro. Agora cada tipo de erro
      // tem sua própria mensagem.
      if (e instanceof ApiError && e.status === 429) {
        setErro('Muitas tentativas de login seguidas. Aguarde um minuto e tente de novo.');
      } else if (e instanceof ApiError && e.status === 401) {
        setErro('E-mail ou senha incorretos.');
      } else if (e instanceof TypeError) {
        // fetch falha com TypeError quando não há conexão nenhuma com o servidor
        setErro('Sem conexão com o servidor. Verifique sua internet.');
      } else {
        setErro('Não foi possível entrar. Tente novamente em instantes.');
      }
      throw new Error('login-falhou');
    } finally {
      setCarregando(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {
      // mesmo se a chamada falhar (ex: já sem conexão), limpa o estado local
    });
    setUsuario(null);
  }, []);

  const atualizarUsuarioLogado = useCallback((dados: Partial<UsuarioLogado>) => {
    setUsuario((atual) => (atual ? { ...atual, ...dados } : atual));
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, carregandoSessao, carregando, erro, login, logout, atualizarUsuarioLogado }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  }
  return context;
}
