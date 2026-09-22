import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../api/config';

// Por padrão, o NetInfo testa "alcançabilidade" pingando um endereço
// genérico (ex: um servidor da Google/Apple) - isso pode falhar em redes
// com bloqueio de operadora ou VPN corporativa mesmo com internet normal
// funcionando, porque o problema não é a internet, é aquele endereço
// específico. Configurado aqui pra testar contra a própria API do
// sistema (rota /health, sem autenticação) - o que realmente importa pro
// app é se DÁ pra falar com o servidor da TechVigia, não com o mundo
// em geral.
NetInfo.configure({
  reachabilityUrl: `${API_URL}/health`,
  reachabilityMethod: 'GET',
  reachabilityTest: async (response) => response.status === 200,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityLongTimeout: 30 * 1000,
  // Sem isso, o Android usa a checagem NATIVA de conectividade por
  // padrão (do próprio sistema operacional) pra decidir
  // isInternetReachable, ignorando completamente a reachabilityUrl
  // configurada acima - foi por isso que a correção anterior não
  // resolveu nada na prática, mesmo com a URL certa configurada.
  useNativeReachability: false,
});

/**
 * Estado de conectividade real do aparelho - diferente de "a fila offline
 * está vazia", que só diz se HOUVE alguma ação que precisou ser enfileirada
 * até agora, não se a rede está disponível NESTE momento. Um aparelho pode
 * estar sem sinal nenhum com a fila vazia (porque o técnico ainda não fez
 * nada offline) e mesmo assim o app mostrava "Online" antes desta correção.
 */
export function useConectividade() {
  // Começa como true (otimista) até a primeira leitura real do NetInfo
  // chegar - evita uma piscada de "Offline" no instante em que a tela abre.
  const [estaConectado, setEstaConectado] = useState(true);

  useEffect(() => {
    const cancelar = NetInfo.addEventListener((estado) => {
      // isInternetReachable pode vir null enquanto o NetInfo ainda está
      // checando - nesse caso, usa só isConnected como sinal disponível.
      const conectado =
        estado.isInternetReachable === null ? !!estado.isConnected : !!estado.isInternetReachable;
      setEstaConectado(conectado);
    });

    return () => cancelar();
  }, []);

  return estaConectado;
}
