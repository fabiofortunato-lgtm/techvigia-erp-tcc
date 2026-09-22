# Como gerar o APK apontando para o servidor certo

## A pegadinha que este arquivo existe para evitar

`EXPO_PUBLIC_API_URL` é resolvida **no momento do build**, não quando o app
roda: o valor vira texto fixo dentro do bundle. Um APK já gerado **não pode
ser reconfigurado** para outro servidor — é preciso gerar outro.

Pior: quando a variável não chega ao build, nada falha. O app usa o valor
padrão (`http://10.0.2.2:3000`, que só existe dentro do emulador) e, no
celular de verdade, todo login simplesmente não responde — sem mensagem
dizendo o motivo.

E o `.env` **não resolve isso num build do EAS**: ele está no `.gitignore`,
então não é enviado para o servidor de build. O `.env` vale só para
`expo start` na sua máquina.

## O jeito certo: perfis do eas.json

O `eas.json` deste diretório já carrega a URL de cada ambiente. Escolha o
perfil e a URL vai junto, sem depender de nenhum arquivo local:

```bash
npx eas build -p android --profile teste
```

| Perfil | Para que serve | API que o app vai usar |
|---|---|---|
| `development` | build de desenvolvimento com Expo Dev Client | `http://10.0.2.2:3000` (emulador Android) |
| `teste` | **APK para instalar no celular** | `https://scantecherp-api.axisnetworks.com.br` |
| `production` | AAB para a Play Store | `https://scantecherp-api.axisnetworks.com.br` |

Quando existir um servidor definitivo, troque a URL no perfil
`production` — e só.

## Conferindo qual servidor o app está usando

A tela de login mostra, no rodapé, o endereço que aquele build usa. Se o
técnico reclamar que "não entra", peça um print da tela de login: se o
endereço estiver errado, o problema é o build, não a senha nem a rede.

## Por que precisa ser HTTPS

Desde o Android 9, o sistema bloqueia tráfego HTTP em texto puro. Um APK
apontando para `http://algum-ip:3000` falha na hora de conectar, mesmo com
o servidor no ar. Os dois endereços acima são HTTPS.

## Rodando no dia a dia (sem gerar APK)

```bash
cp .env.example .env      # e ajuste EXPO_PUBLIC_API_URL
npx expo start
```
