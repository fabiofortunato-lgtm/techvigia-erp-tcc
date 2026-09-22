/**
 * IMPORTANTE: "localhost" NÃO funciona no celular nem no emulador do jeito
 * que funciona no navegador do notebook. "localhost" ali dentro do
 * celular/emulador aponta para o PRÓPRIO celular/emulador, não para o seu
 * notebook rodando a API.
 *
 * O valor de verdade vem do arquivo apps/mobile/.env (variável
 * EXPO_PUBLIC_API_URL) - esse arquivo é local, nunca vai pro zip nem pro
 * GitHub (está no .gitignore), então configurar ele aqui uma vez resolve
 * de vez: nenhuma atualização futura do projeto vai sobrescrever esse valor.
 *
 * Se o arquivo .env não existir ainda, cai no valor padrão abaixo
 * (10.0.2.2, que só funciona em emulador Android) - ajuste conforme onde
 * você está testando:
 *
 * 1) Emulador Android (Android Studio):
 *    EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 - endereço especial que o
 *    emulador Android usa para se referir à máquina host.
 *
 * 2) Simulador iOS (só funciona em Mac):
 *    EXPO_PUBLIC_API_URL=http://localhost:3000 funciona normalmente nesse
 *    caso específico.
 *
 * 3) Celular físico real, usando o app Expo Go:
 *    EXPO_PUBLIC_API_URL=http://SEU_IP_AQUI:3000 - o IP da sua máquina na
 *    rede local. Para descobrir, rode "ipconfig" no PowerShell e procure
 *    por "Endereço IPv4" da sua rede Wi-Fi. O celular precisa estar na
 *    MESMA rede Wi-Fi que o notebook rodando a API.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
