import { Component, ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
  info: string | null;
}

/**
 * Error Boundary - captura erros de renderização que aconteceriam dentro
 * da árvore de componentes envolvida por ele, e mostra a mensagem exata
 * (com a pilha de componentes) direto na tela, em vez de derrubar o app
 * inteiro. Sem isso, um erro de render é só um "AndroidRuntime: FATAL
 * EXCEPTION" no log - com isso, aparece legível na hora, sem precisar de
 * cabo USB nem adb.
 *
 * Uso temporário pra investigação (12/09/2026) - pode continuar depois
 * como proteção permanente, já que impede que um erro de render numa
 * tela específica derrube o app inteiro.
 */
export class ErroBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { erro: null, info: null };
  }

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  componentDidCatch(erro: Error, info: { componentStack: string }) {
    this.setState({ info: info.componentStack });
  }

  render() {
    if (this.state.erro) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
          <Text style={styles.titulo}>⚠️ Erro capturado</Text>
          <Text style={styles.mensagem}>{this.state.erro.message}</Text>
          {this.state.info && <Text style={styles.stack}>{this.state.info}</Text>}
          <TouchableOpacity
            style={styles.botao}
            onPress={() => this.setState({ erro: null, info: null })}
          >
            <Text style={styles.botaoTexto}>Tentar de novo</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24, paddingTop: 60 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#b42318', marginBottom: 12 },
  mensagem: { fontSize: 14, color: '#14161a', marginBottom: 16, fontWeight: '600' },
  stack: { fontSize: 10, color: '#626a78', fontFamily: 'monospace' },
  botao: {
    marginTop: 20,
    backgroundColor: '#0e7490',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoTexto: { color: '#fff', fontWeight: '700' },
});
