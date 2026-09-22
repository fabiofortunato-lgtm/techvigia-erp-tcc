import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { listarPendentes, processarFila, AcaoPendente } from '../offline/queue';
import { cores } from '../theme/colors';

export function SincronizacaoModal({
  visivel,
  onFechar,
  onSincronizado,
}: {
  visivel: boolean;
  onFechar: () => void;
  onSincronizado: () => void;
}) {
  const [pendentes, setPendentes] = useState<AcaoPendente[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (visivel) {
      setResultado(null);
      listarPendentes().then(setPendentes);
    }
  }, [visivel]);

  async function handleSincronizar() {
    setSincronizando(true);
    const resposta = await processarFila(
      (path, metodo, body) => {
        if (metodo === 'PATCH') return api.patch(path, body);
        if (metodo === 'PUT') return api.put(path, body);
        return api.post(path, body);
      },
      (path, campos, arquivo) => api.postArquivo(path, campos, arquivo),
    );
    const listaAtualizada = await listarPendentes();
    setPendentes(listaAtualizada);
    setSincronizando(false);
    setResultado(
      resposta.pendentes > 0
        ? `${resposta.processadas} enviada(s). ${resposta.pendentes} ainda sem conexão.`
        : `${resposta.processadas} ação(ões) sincronizada(s) com sucesso.`,
    );
    onSincronizado();
  }

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Sincronização</Text>
            <TouchableOpacity onPress={onFechar}>
              <Text style={styles.fechar}>✕</Text>
            </TouchableOpacity>
          </View>

          {pendentes.length === 0 ? (
            <View style={styles.estadoOk}>
              <Text style={styles.estadoOkIcone}>✓</Text>
              <Text style={styles.estadoOkTexto}>Tudo sincronizado. Nenhuma pendência.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.mensagem}>
                Você está offline (ou ficou offline em algum momento). {pendentes.length} item(ns)
                aguardando envio:
              </Text>

              <View style={styles.lista}>
                {pendentes.map((acao) => (
                  <View key={acao.id} style={styles.itemLinha}>
                    <Text style={styles.itemBolinha}>•</Text>
                    <Text style={styles.itemTexto}>{acao.descricao}</Text>
                  </View>
                ))}
              </View>

              {resultado && <Text style={styles.resultado}>{resultado}</Text>}

              <TouchableOpacity
                style={styles.botaoSincronizar}
                onPress={handleSincronizar}
                disabled={sincronizando}
              >
                {sincronizando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoSincronizarTexto}>Sincronizar agora</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {pendentes.length === 0 && (
            <TouchableOpacity style={styles.botaoFechar} onPress={onFechar}>
              <Text style={styles.botaoFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,22,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: cores.superficie,
    borderRadius: 16,
    padding: 20,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 16, fontWeight: '700', color: cores.textoTitulo },
  fechar: { fontSize: 16, color: cores.textoMuted, padding: 4 },
  mensagem: { fontSize: 13, color: cores.textoMuted, lineHeight: 19, marginBottom: 12 },
  lista: { gap: 6, marginBottom: 16 },
  itemLinha: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  itemBolinha: { color: cores.aviso, fontSize: 13 },
  itemTexto: { fontSize: 13, color: cores.texto, flex: 1 },
  resultado: {
    fontSize: 12.5,
    color: cores.cyanForte,
    marginBottom: 12,
    textAlign: 'center',
  },
  botaoSincronizar: {
    backgroundColor: cores.cyan,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoSincronizarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  estadoOk: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  estadoOkIcone: { fontSize: 28, color: cores.sucesso },
  estadoOkTexto: { fontSize: 13.5, color: cores.textoMuted, textAlign: 'center' },
  botaoFechar: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  botaoFecharTexto: { color: cores.textoMuted, fontWeight: '600', fontSize: 13.5 },
});
