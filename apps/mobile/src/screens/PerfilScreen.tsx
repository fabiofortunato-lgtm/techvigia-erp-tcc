import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme/colors';
import { IconMail, IconLogOut, IconReceipt, IconRefreshCw, IconChevronRight } from '../theme/icons';
import { TexturaDiagonal } from '../components/TexturaDiagonal';
import { SincronizacaoModal } from '../components/SincronizacaoModal';
import { listarPendentes } from '../offline/queue';

const ITENS_EM_BREVE = [
  { label: 'Faturamento', Icone: IconReceipt, cor: cores.cyanForte, fundo: cores.infoFundo },
];

export function PerfilScreen() {
  const { usuario, logout } = useAuth();
  const [mostrarSync, setMostrarSync] = useState(false);
  const [pendentesOffline, setPendentesOffline] = useState(0);

  const inicial = usuario?.nome?.charAt(0).toUpperCase() ?? '?';

  const atualizarContagemOffline = useCallback(() => {
    listarPendentes().then((lista) => setPendentesOffline(lista.length));
  }, []);

  useEffect(() => {
    atualizarContagemOffline();
  }, [atualizarContagemOffline]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[cores.navy, cores.cyan]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <TexturaDiagonal />
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{inicial}</Text>
        </View>
        <Text style={styles.nome}>{usuario?.nome}</Text>
        <View style={styles.badgeCargo}>
          <View style={styles.badgeCargoPonto} />
          <Text style={styles.badgeCargoTexto}>{usuario?.perfil}</Text>
        </View>
      </LinearGradient>

      <View style={styles.conteudo}>
        <View style={styles.cartaoEmail}>
          <IconMail size={16} color={cores.textoMuted} />
          <Text style={styles.cartaoEmailTexto}>{usuario?.email}</Text>
        </View>

        <Text style={styles.secaoLabel}>Menu</Text>
        <View style={styles.grupoEmBreve}>
          <TouchableOpacity style={styles.itemEmBreve} onPress={() => setMostrarSync(true)}>
            <View style={[styles.itemEmBreveIcone, { backgroundColor: cores.sucessoFundo }]}>
              <IconRefreshCw size={16} color={cores.sucesso} />
            </View>
            <Text style={styles.itemEmBreveLabel}>Sincronização</Text>
            {pendentesOffline > 0 && (
              <View style={styles.badgePendencia}>
                <Text style={styles.badgePendenciaTexto}>{pendentesOffline}</Text>
              </View>
            )}
            <IconChevronRight size={16} color={cores.textoMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.secaoLabel}>Em breve</Text>
        <View style={styles.grupoEmBreve}>
          {ITENS_EM_BREVE.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.itemEmBreve,
                index < ITENS_EM_BREVE.length - 1 && styles.itemEmBreveComBorda,
              ]}
            >
              <View style={[styles.itemEmBreveIcone, { backgroundColor: item.fundo }]}>
                <item.Icone size={16} color={item.cor} />
              </View>
              <Text style={styles.itemEmBreveLabel}>{item.label}</Text>
              <View style={styles.tagEmBreve}>
                <Text style={styles.tagEmBreveTexto}>EM BREVE</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.botaoSair} onPress={logout}>
          <IconLogOut size={15} color={cores.perigo} />
          <Text style={styles.botaoSairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>

      <SincronizacaoModal
        visivel={mostrarSync}
        onFechar={() => setMostrarSync(false)}
        onSincronizado={atualizarContagemOffline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  banner: {
    paddingTop: 34,
    paddingHorizontal: 22,
    paddingBottom: 46,
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarTexto: { color: '#fff', fontSize: 27, fontWeight: '800' },
  nome: { fontSize: 17, fontWeight: '800', color: '#fff' },
  badgeCargo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,165,148,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeCargoPonto: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  badgeCargoTexto: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  conteudo: { paddingHorizontal: 18 },
  cartaoEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: -24,
  },
  cartaoEmailTexto: { fontSize: 13, color: cores.texto },
  secaoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.textoMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 24,
    marginBottom: 8,
  },
  grupoEmBreve: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    overflow: 'hidden',
  },
  itemEmBreve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemEmBreveComBorda: { borderBottomWidth: 1, borderBottomColor: cores.borda },
  itemEmBreveIcone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmBreveLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: cores.texto },
  tagEmBreve: {
    backgroundColor: cores.fundo,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagEmBreveTexto: { fontSize: 9.5, fontWeight: '700', color: cores.textoMuted },
  badgePendencia: {
    backgroundColor: cores.perigo,
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    marginRight: 4,
  },
  badgePendenciaTexto: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  botaoSair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    borderRadius: 10,
    paddingVertical: 13,
  },
  botaoSairTexto: { color: cores.perigo, fontWeight: '700', fontSize: 13.5 },
});
