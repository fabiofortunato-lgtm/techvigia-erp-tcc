import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme/colors';
import { IconArrowRight } from '../theme/icons';
import { TexturaDiagonal } from '../components/TexturaDiagonal';

export function LoginScreen() {
  const { login, carregandoLogin, erro } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function handleLogin() {
    try {
      await login(email, senha);
    } catch {
      // erro já fica disponível via useAuth().erro
    }
  }

  function handleEsqueciSenha() {
    Alert.alert(
      'Recuperação de senha',
      'Por enquanto, a recuperação de senha é feita pelo painel web. Acesse pelo navegador do computador.',
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[cores.navy, cores.cyan, cores.cyanForte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.topo}
        >
          <TexturaDiagonal />
          <Image
            source={require('../../assets/techvigia-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </LinearGradient>

        <View style={styles.sheet}>
          <Text style={styles.titulo}>Bem-vindo de volta</Text>
          <Text style={styles.subtitulo}>Ordem de serviço digital para condomínios</Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@techvigia-demo.com"
            placeholderTextColor={cores.textoMuted}
          />

          <Text style={styles.label}>Senha</Text>
          <View style={styles.senhaWrapper}>
            <TextInput
              style={styles.inputSenha}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor={cores.textoMuted}
            />
            <TouchableOpacity
              style={styles.botaoMostrarSenha}
              onPress={() => setMostrarSenha((atual) => !atual)}
            >
              <Text style={styles.botaoMostrarSenhaTexto}>
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.linkEsqueciSenha} onPress={handleEsqueciSenha}>
            <Text style={styles.linkEsqueciSenhaTexto}>Esqueci minha senha</Text>
          </TouchableOpacity>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <TouchableOpacity style={styles.botao} onPress={handleLogin} disabled={carregandoLogin}>
            {carregandoLogin ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.botaoTexto}>Entrar</Text>
                <IconArrowRight size={16} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.rodapeTexto}>
            Seu perfil (Técnico ou Administrador) é definido pelo cadastro - a navegação se
            ajusta automaticamente após o login.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.superficie },
  topo: {
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  logo: { width: 200, height: 84 },
  sheet: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    padding: 22,
    paddingTop: 26,
  },
  titulo: { fontSize: 19, fontWeight: '800', color: cores.textoTitulo },
  subtitulo: { fontSize: 12.5, color: cores.textoMuted, marginTop: 4, marginBottom: 20 },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: cores.textoMuted,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: cores.texto,
    backgroundColor: cores.fundo,
  },
  senhaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    backgroundColor: cores.fundo,
  },
  inputSenha: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 14,
    color: cores.texto,
  },
  botaoMostrarSenha: { paddingHorizontal: 12 },
  botaoMostrarSenhaTexto: { color: cores.cyanForte, fontSize: 12, fontWeight: '700' },
  linkEsqueciSenha: { alignSelf: 'flex-end', marginTop: 10 },
  linkEsqueciSenhaTexto: { fontSize: 12.5, fontWeight: '600', color: cores.texto },
  erro: { color: cores.perigo, fontSize: 13, marginTop: 14 },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: cores.cyan,
    borderRadius: 10,
    marginTop: 22,
  },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
  rodapeTexto: {
    marginTop: 18,
    fontSize: 11,
    color: cores.textoMuted,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 16,
  },
});
