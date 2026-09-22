import { registerRootComponent } from 'expo';
import App from './App';

// Usamos um entrypoint próprio (em vez do node_modules/expo/AppEntry.js
// padrão) porque, dentro de um monorepo com npm workspaces, o pacote
// `expo` pode acabar instalado na raiz do projeto (hoisting), e o
// AppEntry.js padrão usa um caminho relativo que quebra nesse cenário.
// Controlando o import do App.tsx aqui diretamente, isso nunca falha,
// independente de onde o npm decidiu instalar o pacote expo.
registerRootComponent(App);
