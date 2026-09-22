import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'scantech_access_token';
const REFRESH_KEY = 'scantech_refresh_token';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Erro de rede de verdade (sem conexão, DNS falhou, etc) - diferente de
// ApiError, que significa "a API respondeu, só que com um erro". Essa
// distinção é o que permite à fila offline saber quando vale a pena
// reenfileirar uma ação (rede fora) e quando não vale (erro de validação
// nunca vai funcionar só de tentar de novo).
export class ErroDeRede extends Error {}

// Chamado quando a renovação automática falha de verdade (refresh token
// também expirado/inválido) - única situação em que o técnico precisa
// logar de novo manualmente. Registrado pelo AuthContext na inicialização;
// fica null em qualquer teste/uso isolado deste módulo.
let aoSessaoExpirar: (() => void) | null = null;
export function registrarCallbackSessaoExpirada(callback: () => void) {
  aoSessaoExpirar = callback;
}

// Evita disparar duas renovações em paralelo se várias chamadas à API
// falharem com 401 ao mesmo tempo (comum quando o token expira bem no
// meio de uma tela que faz 2-3 requisições juntas) - todas esperam a
// MESMA renovação em andamento, em vez de cada uma tentar a sua.
let renovacaoEmAndamento: Promise<string | null> | null = null;

async function renovarToken(): Promise<string | null> {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;

  renovacaoEmAndamento = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return null;

      const dados = await response.json();
      await SecureStore.setItemAsync(TOKEN_KEY, dados.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, dados.refreshToken);
      return dados.accessToken as string;
    } catch {
      return null; // sem conexão nesse instante - não é o mesmo que "sessão inválida"
    }
  })();

  const resultado = await renovacaoEmAndamento;
  renovacaoEmAndamento = null;
  return resultado;
}

async function fazerRequisicao(path: string, options: RequestInit, token: string | null) {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ErroDeRede('Sem conexão com o servidor');
  }
}

async function request<T>(path: string, options: RequestInit = {}, jaTentouRenovar = false): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const response = await fazerRequisicao(path, options, token);

  // Token de acesso expirado (dura só 15 minutos) - tenta renovar
  // silenciosamente usando o refresh token (dura 7 dias) antes de admitir
  // derrota. Sem isso, o técnico via "sessão expirada" a cada 15 minutos
  // de uso, mesmo no meio de uma visita.
  if (response.status === 401 && !jaTentouRenovar && path !== '/auth/refresh' && path !== '/auth/login') {
    const novoToken = await renovarToken();
    if (novoToken) {
      return request<T>(path, options, true);
    }
    // Refresh também falhou - a sessão de verdade expirou (ou o usuário
    // foi desativado). Aí sim precisa logar de novo.
    aoSessaoExpirar?.();
  }

  if (!response.ok) {
    const corpo = await response.json().catch(() => ({}));
    throw new ApiError(corpo.message || `Erro ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  // Upload de arquivo - `arquivo` no formato { uri, name, type } que o
  // expo-image-picker devolve, direto compatível com o FormData do React Native.
  postArquivo: <T>(
    path: string,
    campos: Record<string, string>,
    arquivo: { uri: string; name: string; type: string },
  ) => {
    const formData = new FormData();
    Object.entries(campos).forEach(([chave, valor]) => formData.append(chave, valor));
    // @ts-expect-error - o FormData do React Native aceita esse formato de
    // objeto para arquivos, diferente do FormData do navegador (que espera Blob)
    formData.append('arquivo', arquivo);
    return request<T>(path, { method: 'POST', body: formData });
  },
};
