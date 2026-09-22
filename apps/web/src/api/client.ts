// Em desenvolvimento local, fica em branco e usa o caminho relativo
// "/api" (o Vite redireciona pra API na porta 3000 - ver vite.config.ts).
// Em produção, hospedando o painel e a API em serviços separados
// (ex: painel na Vercel, API no Railway), defina VITE_API_URL com o
// endereço completo da API no ambiente de build.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    // Essencial para o cookie httpOnly ser enviado/recebido - sem isso, o
    // navegador não manda o cookie de sessão junto com a requisição.
    credentials: 'include',
    headers: {
      // Para upload de arquivo (FormData), NÃO define Content-Type manualmente -
      // o navegador precisa gerar o boundary do multipart sozinho. Definir isso
      // na mão quebra o upload silenciosamente.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const corpo = await response.json().catch(() => ({}));
    throw new ApiError(
      corpo.message || `Erro ${response.status}`,
      response.status,
    );
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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};
