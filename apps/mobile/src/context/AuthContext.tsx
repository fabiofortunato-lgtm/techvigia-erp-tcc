import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, ErroDeRede, registrarCallbackSessaoExpirada } from '../api/client';

const TOKEN_KEY = 'scantech_access_token';
const REFRESH_KEY = 'scantech_refresh_token';

interface UsuarioLogado {
  id: string;
  email: string;
  nome: string;
  perfil: 'ADMIN' | 'GESTOR' | 'TECNICO';
}

interface AuthContextValue {
  usuario: UsuarioLogado | null;
  carregandoSessao: boolean;
  carregandoLogin: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Decodificador base64 simples e autocontido - evita depender de `atob`
// (não existe no React Native) ou de `Buffer` (nem sempre disponível
// sem polyfill extra no Hermes/Expo).
function decodificarBase64(input: string): string {
  let str = input.replace(/=+$/, '');
  let output = '';

  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
    buffer = BASE64_CHARS.indexOf(buffer);
    if (buffer === -1) continue;
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }

  return output;
}

function decodificarPayload(token: string): UsuarioLogado | null {
  try {
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(decodificarBase64(payloadBase64));
    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome ?? payload.email,
      perfil: payload.perfil,
    };
  } catch {
    return null;
  }
}

// Garante que uma Promise nunca trave o app para sempre - se não resolver
// dentro do prazo, usa o valor de reserva em vez de ficar esperando
// indefinidamente. Existe porque a checagem inicial de sessão (abaixo)
// já causou uma tela de carregamento travada para sempre num teste real
// em campo - com isso, na pior das hipóteses (SecureStore travando por
// algum motivo específico do aparelho), o app cai para a tela de login
// depois de alguns segundos, em vez de nunca abrir.
function comTimeout<T>(promise: Promise<T>, milissegundos: number, valorReserva: T): Promise<T> {
  return new Promise((resolve) => {
    const cronometro = setTimeout(() => resolve(valorReserva), milissegundos);
    promise
      .then((valor) => {
        clearTimeout(cronometro);
        resolve(valor);
      })
      .catch(() => {
        clearTimeout(cronometro);
        resolve(valorReserva);
      });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao abrir o app, verifica se já existe um token salvo de uma sessão
  // anterior - guardado no Keychain (iOS) / Keystore (Android) via
  // SecureStore, criptografado em repouso (diferente do AsyncStorage puro,
  // que grava em texto simples).
  useEffect(() => {
    comTimeout(SecureStore.getItemAsync(TOKEN_KEY), 5000, null)
      .then((token) => {
        if (token) setUsuario(decodificarPayload(token));
      })
      .finally(() => setCarregandoSessao(false));
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    setCarregandoLogin(true);
    setErro(null);
    try {
      const resposta = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, senha },
      );
      await SecureStore.setItemAsync(TOKEN_KEY, resposta.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, resposta.refreshToken);
      setUsuario(decodificarPayload(resposta.accessToken));
    } catch (e) {
      // Antes, qualquer falha aqui (senha errada, rate limit, sem conexão,
      // erro do servidor) mostrava sempre "E-mail ou senha incorretos" -
      // enganoso quando o problema real era outro. Agora cada tipo de erro
      // tem sua própria mensagem.
      if (e instanceof ErroDeRede) {
        setErro('Sem conexão com o servidor. Verifique sua internet.');
      } else if (e instanceof ApiError && e.status === 429) {
        setErro('Muitas tentativas de login seguidas. Aguarde um minuto e tente de novo.');
      } else if (e instanceof ApiError && e.status === 401) {
        setErro('E-mail ou senha incorretos.');
      } else {
        setErro('Não foi possível entrar. Tente novamente em instantes.');
      }
      throw new Error('login-falhou');
    } finally {
      setCarregandoLogin(false);
    }
  }, []);

  const logout = useCallback(() => {
    SecureStore.deleteItemAsync(TOKEN_KEY);
    SecureStore.deleteItemAsync(REFRESH_KEY);
    api.post('/auth/logout').catch(() => {
      // sem problema se falhar (ex: já offline) - o que importa é limpar
      // o token guardado localmente, feito acima
    });
    setUsuario(null);
  }, []);

  // Registra esse logout como o que roda quando a renovação automática de
  // token falha de verdade (refresh token também expirado/inválido) - só
  // nesse caso o técnico precisa logar de novo manualmente.
  useEffect(() => {
    registrarCallbackSessaoExpirada(logout);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ usuario, carregandoSessao, carregandoLogin, erro, login, logout }}
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
