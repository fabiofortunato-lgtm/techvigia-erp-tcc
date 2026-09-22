import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { InicioScreen } from './src/screens/InicioScreen';
import { RelatoriosScreen } from './src/screens/RelatoriosScreen';
import { PerfilScreen } from './src/screens/PerfilScreen';
import { ManutencaoDetalheScreen } from './src/screens/ManutencaoDetalheScreen';
import { ErroBoundary } from './src/components/ErroBoundary';
import { cores } from './src/theme/colors';

type Aba = 'INICIO' | 'RELATORIOS' | 'PERFIL';

function Conteudo() {
  const { usuario, carregandoSessao } = useAuth();
  const [aba, setAba] = useState<Aba>('INICIO');
  const [manutencaoSelecionada, setManutencaoSelecionada] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  if (carregandoSessao) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen />
      </>
    );
  }

  if (!usuario) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }

  if (manutencaoSelecionada) {
    return (
      <ManutencaoDetalheScreen
        manutencaoId={manutencaoSelecionada}
        onVoltar={() => setManutencaoSelecionada(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.conteudoAba}>
        {aba === 'INICIO' && (
          <ErroBoundary>
            <InicioScreen onSelecionar={setManutencaoSelecionada} />
          </ErroBoundary>
        )}
        {aba === 'RELATORIOS' && <RelatoriosScreen />}
        {aba === 'PERFIL' && <PerfilScreen />}
      </View>

      {/* paddingBottom soma a área segura do aparelho (barra de gestos ou
          botões de navegação do Android) - sem isso, a barra de abas fica
          escondida atrás dos botões do sistema em vários celulares. */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setAba('INICIO')}>
          <Text style={[styles.tabTexto, aba === 'INICIO' && styles.tabTextoAtivo]}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setAba('RELATORIOS')}>
          <Text style={[styles.tabTexto, aba === 'RELATORIOS' && styles.tabTextoAtivo]}>
            Relatórios
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setAba('PERFIL')}>
          <Text style={[styles.tabTexto, aba === 'PERFIL' && styles.tabTextoAtivo]}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Conteudo />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudoAba: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabTexto: { fontSize: 12.5, color: cores.textoMuted, fontWeight: '600' },
  tabTextoAtivo: { color: cores.cyanForte, fontWeight: '700' },
});
