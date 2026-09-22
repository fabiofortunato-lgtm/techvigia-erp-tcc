# Como investigar um crash no app mobile

Guia de referência rápida - passos que funcionaram bem pra achar a causa de um crash
("abre e fecha") no app Android. Usar isso antes de tentar adivinhar lendo código.

## 1. Capturar o log do crash (adb)

Precisa do `adb` (parte do Android SDK). Não precisa instalar o Android Studio inteiro - só
o pacote leve oficial da Google:

**https://developer.android.com/tools/releases/platform-tools**

Baixa o zip pra Windows, extrai numa pasta fixa (ex: `C:\platform-tools`), e usa o caminho
completo:

```powershell
C:\platform-tools\adb.exe devices
```

Deve aparecer o número de série do celular (conectado via USB, com Depuração USB ativada nas
opções de desenvolvedor). Se aparecer, segue:

```powershell
C:\platform-tools\adb.exe logcat -c
```

Abre o app no celular, deixa ele crashar. Volta pro PowerShell:

```powershell
C:\platform-tools\adb.exe logcat *:E *> crash.txt
```

Espera uns 5 segundos, Ctrl+C. Abre o `crash.txt` e procura por **"FATAL"** ou
**"AndroidRuntime"** - é ali que está a causa.

**Cuidado**: se for testar de novo, sempre roda `logcat -c` (limpar) antes de cada tentativa,
e **desinstale o app completamente** antes de instalar uma versão nova pra testar - o Android
às vezes mantém a instalação antiga se algo falhar silenciosamente na hora de sobrescrever.

## 2. Testar ao vivo com Expo Go (muito mais rápido que gerar APK)

Gerar um APK novo a cada tentativa leva minutos. Pra investigar um crash, é bem mais rápido
testar ao vivo:

```powershell
cd apps\mobile
npx expo start --lan
```

(`--lan` funciona quando o celular e o computador estão na mesma rede Wi-Fi - é mais
confiável que `--tunnel`, que depende de um serviço externo (ngrok) e pode falhar por
instabilidade de rede.)

Abre o app **Expo Go** no celular (grátis, na Play Store), escaneia o QR Code. Qualquer
mudança no código aparece só puxando pra atualizar na tela - sem precisar reiniciar nada.

## 3. Error Boundary - ver o erro exato na tela, sem cabo

Existe um componente em `apps/mobile/src/components/ErroBoundary.tsx` que envolve a tela de
início (`App.tsx`). Quando um erro de render acontece dentro dele, em vez de derrubar o app
inteiro, aparece uma tela com a mensagem de erro completa e a pilha de componentes - dá pra
tirar print e mandar direto, sem precisar de `adb`/log nenhum.

Se for investigar um crash em **outra tela** (não a de início), vale envolver ela também com
esse mesmo componente, do mesmo jeito que foi feito em `App.tsx`:

```tsx
import { ErroBoundary } from './src/components/ErroBoundary';

// ...
<ErroBoundary>
  <TelaQueEstaCrashing />
</ErroBoundary>
```

## 4. Eliminação sistemática

Quando a leitura de código não encontra nada óbvio (aconteceu com o crash de
12/09/2026 - ver `docs/trabalho/2026-09-12-investigacao-crash-element-type-invalid.md`),
o caminho que funciona é desligar partes da tela **uma de cada vez**, testando ao vivo pelo
Expo Go depois de cada mudança:

1. Identifica os "blocos" grandes da tela (um modal, uma seção condicional, uma lista)
2. Desliga um bloco por vez (ex: troca a condição por `false &&`, ou substitui o componente
   por algo trivial como `<Text>teste</Text>`)
3. Testa ao vivo (Expo Go, puxar pra atualizar)
4. Se o crash sumir → achou o bloco culpado, investiga só ele
5. Se continuar → religa esse bloco, desliga o próximo

Isso é mais lento que achar de cara, mas é **garantido** - eventualmente isola o problema,
mesmo quando a causa não faz sentido óbvio pela leitura do código.

## Causas já identificadas nesse projeto (pra não repetir a investigação)

- **`tecnico: null` sem tratamento** (12/09/2026) - qualquer tela que mostra `.tecnico.nome`
  direto quebra se a OS foi gerada automaticamente (sem técnico atribuído ainda). Sempre usar
  `item.tecnico?.nome ?? 'algum texto padrão'`.
- **Ícones SVG novos causando "Element type is invalid"** (12/09/2026) - dois ícones
  adicionados em `theme/icons.tsx` (`IconSearch`, `IconX`) causavam esse erro especificamente
  nessa tela, por um motivo não identificado com certeza. Resolvido trocando por texto/emoji
  no lugar do ícone SVG. Se um ícone novo causar esse mesmo erro de novo, considerar usar
  texto/emoji como alternativa rápida em vez de insistir em descobrir a causa exata.
