import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { listarPendentes } from '../offline/queue';
import { SincronizacaoModal } from '../components/SincronizacaoModal';
import { NovaOsModal } from '../components/NovaOsModal';
import { OsCard, OsCardData, estaAtrasada } from '../components/OsCard';
import { ListaSkeleton } from '../components/ListaSkeleton';
import { cores } from '../theme/colors';
import { IconClipboardList, IconWrench, IconAlertTriangle, IconCheckCircle } from '../theme/icons';
import { TexturaDiagonal } from '../components/TexturaDiagonal';
import { useConectividade } from '../hooks/useConectividade';

type FiltroStatus = 'ABERTAS' | 'EM_ANDAMENTO' | 'ATRASADAS' | 'CONCLUIDAS';

// Ignora acentos e maiúsculas/minúsculas na busca - "ap 202" deve achar
// "AP 202" e "Condomínio" deve achar "condominio" sem acento.
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function categoriaDe(m: OsCardData): FiltroStatus | null {
  if (m.status === 'CONCLUIDA') return 'CONCLUIDAS';
  if (m.status === 'EM_ANDAMENTO') return 'EM_ANDAMENTO';
  if (m.status === 'AGENDADA') {
    return estaAtrasada(m) ? 'ATRASADAS' : 'ABERTAS';
  }
  return null; // CANCELADA, PENDENTE_SINCRONIZACAO não entram nos 4 cards
}

export function InicioScreen({ onSelecionar }: { onSelecionar: (id: string) => void }) {
  const { usuario, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [manutencoes, setManutencoes] = useState<OsCardData[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroStatus | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(0);
  const estaConectado = useConectividade();
  const [mostrarSync, setMostrarSync] = useState(false);
  const [mostrarNovaOs, setMostrarNovaOs] = useState(false);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState('');

  const ehTecnico = usuario?.perfil === 'TECNICO';
  const podeCriarOs = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'GESTOR';

  const carregar = useCallback(() => {
    setErro(null);
    return api
      .get<OsCardData[]>('/manutencoes')
      .then(setManutencoes)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar as ordens de serviço.'));
  }, []);

  const atualizarContagemOffline = useCallback(() => {
    listarPendentes().then((lista) => setPendentesOffline(lista.length));
  }, []);

  useEffect(() => {
    carregar();
    atualizarContagemOffline();
  }, [carregar, atualizarContagemOffline]);

  async function handleRefresh() {
    setAtualizando(true);
    await carregar();
    await atualizarContagemOffline();
    setAtualizando(false);
  }

  // Um técnico vê só as OS dele; ADMIN/GESTOR veem tudo (mesma lógica do painel web).
  // Ordenado por mais recente primeiro - sem isso, a API devolve na ordem
  // cronológica crescente, e um chamado recém-criado ficava escondido lá
  // no final da lista, exigindo rolar tudo pra achar.
  const listaBase = useMemo(() => {
    if (!manutencoes) return [];
    const filtrada = ehTecnico && usuario
      ? manutencoes.filter((m) => m.tecnico?.id === usuario.id)
      : manutencoes;
    return [...filtrada].sort((a, b) => {
      const dataA = a.inicio ? new Date(a.inicio).getTime() : 0;
      const dataB = b.inicio ? new Date(b.inicio).getTime() : 0;
      return dataB - dataA;
    });
  }, [manutencoes, ehTecnico, usuario]);

  const contagens = useMemo(() => {
    const base = { ABERTAS: 0, EM_ANDAMENTO: 0, ATRASADAS: 0, CONCLUIDAS: 0 };
    listaBase.forEach((m) => {
      const cat = categoriaDe(m);
      if (cat) base[cat]++;
    });
    return base;
  }, [listaBase]);

  const listaFiltrada = useMemo(() => {
    if (!filtro) return listaBase;
    return listaBase.filter((m) => categoriaDe(m) === filtro);
  }, [listaBase, filtro]);

  const listaExibida = useMemo(() => {
    const termo = normalizar(buscaTexto.trim());
    if (!termo) return listaFiltrada;
    return listaFiltrada.filter((m) => {
      const alvo = normalizar(
        `${m.numeroOS} ${m.condominio.nome} ${m.observacao ?? ''}`,
      );
      return alvo.includes(termo);
    });
  }, [listaFiltrada, buscaTexto]);

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? '';
  const subtitulo = ehTecnico
    ? 'Suas ordens de serviço de hoje'
    : 'Visão geral de todos os condomínios administrados';

  const cards: {
    label: string;
    valor: number;
    chave: FiltroStatus;
    cor: string;
    fundo: string;
    Icone: typeof IconClipboardList;
  }[] = [
    { label: 'Abertas', valor: contagens.ABERTAS, chave: 'ABERTAS', cor: cores.info, fundo: cores.infoFundo, Icone: IconClipboardList },
    { label: 'Em execução', valor: contagens.EM_ANDAMENTO, chave: 'EM_ANDAMENTO', cor: cores.aviso, fundo: cores.avisoFundo, Icone: IconWrench },
    { label: 'Atrasadas', valor: contagens.ATRASADAS, chave: 'ATRASADAS', cor: cores.perigo, fundo: cores.perigoFundo, Icone: IconAlertTriangle },
    { label: 'Concluídas', valor: contagens.CONCLUIDAS, chave: 'CONCLUIDAS', cor: cores.sucesso, fundo: cores.sucessoFundo, Icone: IconCheckCircle },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLogoChip}>
          <Image source={require('../../assets/techvigia-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.headerAcoes}>
          <TouchableOpacity
            style={[
              styles.pillConexao,
              !estaConectado && styles.pillConexaoOffline,
              estaConectado && pendentesOffline > 0 && styles.pillConexaoPendente,
            ]}
            onPress={() => setMostrarSync(true)}
          >
            <View
              style={[
                styles.pillConexaoPonto,
                {
                  backgroundColor: !estaConectado
                    ? '#fff'
                    : pendentesOffline > 0
                      ? cores.aviso
                      : cores.cyanBrilhante,
                },
              ]}
            />
            <Text
              style={[
                styles.pillConexaoTexto,
                (!estaConectado || pendentesOffline > 0) && styles.pillConexaoTextoOffline,
              ]}
            >
              {!estaConectado
                ? 'Offline'
                : pendentesOffline > 0
                  ? `Sincronizar · ${pendentesOffline}`
                  : 'Online'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoSair} onPress={logout}>
            <Text style={styles.botaoSairTexto}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={listaExibida}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listaContainer}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={[cores.navy, cores.cyan]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <TexturaDiagonal />
              <Text style={styles.bannerSaudacao}>Olá, {primeiroNome}</Text>
              <Text style={styles.bannerSubtitulo}>{subtitulo}</Text>
            </LinearGradient>

            {erro && (
              <View style={styles.erroBox}>
                <Text style={styles.erroTexto}>{erro}</Text>
              </View>
            )}

            {manutencoes && (
              <View style={styles.statsGrid}>
                {cards.map((card) => {
                  const ativo = filtro === card.chave;
                  const destaqueAtrasadas = card.chave === 'ATRASADAS' && card.valor > 0;
                  const Icone = card.Icone;
                  return (
                    <TouchableOpacity
                      key={card.chave}
                      style={[
                        styles.statCard,
                        destaqueAtrasadas && styles.statCardDestaque,
                        ativo && { borderColor: card.cor, borderWidth: 2 },
                      ]}
                      onPress={() => setFiltro(ativo ? null : card.chave)}
                    >
                      <View
                        style={[
                          styles.statIcone,
                          { backgroundColor: destaqueAtrasadas ? 'rgba(255,255,255,0.55)' : card.fundo },
                        ]}
                      >
                        <Icone size={16} color={card.cor} />
                      </View>
                      <Text style={[styles.statValor, { color: card.cor }]}>{card.valor}</Text>
                      <Text
                        style={[
                          styles.statLabel,
                          destaqueAtrasadas && { color: cores.perigo, fontWeight: '700' },
                        ]}
                      >
                        {card.label}
                      </Text>
                      {destaqueAtrasadas && <Text style={styles.statAtencao}>Requer atenção</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {filtro && (
              <TouchableOpacity onPress={() => setFiltro(null)} style={styles.filtroAtivoLinha}>
                <Text style={styles.filtroAtivoTexto}>
                  Filtro: {cards.find((c) => c.chave === filtro)?.label} ✕
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.listaTituloLinha}>
              <Text style={styles.listaTitulo}>
                {ehTecnico ? 'Minhas ordens de serviço' : 'Chamados recentes'}
              </Text>
              <TouchableOpacity
                style={styles.botaoBusca}
                onPress={() => {
                  if (mostrarBusca) setBuscaTexto('');
                  setMostrarBusca((v) => !v);
                }}
              >
                <Text style={styles.botaoBuscaTexto}>{mostrarBusca ? '✕' : '🔍'}</Text>
              </TouchableOpacity>
            </View>

            {mostrarBusca && (
              <View style={styles.buscaContainer}>
                <Text style={styles.buscaIconeTexto}>🔍</Text>
                <TextInput
                  style={styles.buscaInput}
                  placeholder='Buscar por assunto (ex: "AP 202")...'
                  placeholderTextColor={cores.textoMuted}
                  value={buscaTexto}
                  onChangeText={setBuscaTexto}
                  autoFocus
                />
              </View>
            )}

            {!manutencoes && !erro && <ListaSkeleton />}
          </>
        }
        ListEmptyComponent={
          manutencoes ? (
            <View style={styles.vazioCard}>
              <View style={styles.vazioIcone}>
                <IconClipboardList size={24} color={cores.info} />
              </View>
              <Text style={styles.vazioTitulo}>
                {buscaTexto.trim() ? 'Nada encontrado pra essa busca' : 'Nenhuma OS neste status'}
              </Text>
              <Text style={styles.vazioSubtitulo}>
                {buscaTexto.trim()
                  ? 'Tenta buscar por outro termo, ou toca no X pra limpar a busca.'
                  : 'Novas ordens aparecem aqui assim que forem abertas.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <OsCard item={item} onPress={() => onSelecionar(item.id)} />}
      />

      <SincronizacaoModal
        visivel={mostrarSync}
        onFechar={() => setMostrarSync(false)}
        onSincronizado={() => {
          atualizarContagemOffline();
          carregar();
        }}
      />

      {podeCriarOs && (
        <>
          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            onPress={() => setMostrarNovaOs(true)}
          >
            <Text style={styles.fabTexto}>+</Text>
          </TouchableOpacity>
          <NovaOsModal
            visivel={mostrarNovaOs}
            onFechar={() => setMostrarNovaOs(false)}
            onCriada={(novaId) => {
              carregar();
              onSelecionar(novaId);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  headerLogoChip: {
    backgroundColor: cores.navy,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  headerLogo: { height: 34, width: 141 },
  headerAcoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botaoSair: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  botaoSairTexto: { fontSize: 11.5, fontWeight: '700', color: cores.perigo },
  pillConexao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillConexaoOffline: { backgroundColor: cores.navy, borderColor: cores.navy },
  pillConexaoPendente: { backgroundColor: cores.aviso, borderColor: cores.aviso },
  pillConexaoPonto: { width: 6, height: 6, borderRadius: 3 },
  pillConexaoTexto: { fontSize: 10.5, fontWeight: '700', color: cores.textoMuted },
  pillConexaoTextoOffline: { color: '#fff' },
  listaContainer: { paddingBottom: 90 },
  banner: {
    borderRadius: 16,
    margin: 18,
    marginBottom: 0,
    padding: 20,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  bannerSaudacao: { fontSize: 18, fontWeight: '800', color: '#fff' },
  bannerSubtitulo: { fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  erroBox: { margin: 18, padding: 12, backgroundColor: cores.perigoFundo, borderRadius: 8 },
  erroTexto: { color: cores.perigo, fontSize: 13 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: cores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 14,
  },
  statCardDestaque: {
    backgroundColor: cores.perigoFundo,
    borderColor: 'rgba(180,35,24,0.22)',
  },
  statIcone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValor: { fontSize: 23, fontWeight: '800' },
  statLabel: { fontSize: 11.5, color: cores.textoMuted, marginTop: 2, fontWeight: '600' },
  statAtencao: { fontSize: 10.5, color: cores.perigo, fontWeight: '700', marginTop: 3 },
  filtroAtivoLinha: { paddingHorizontal: 18, paddingTop: 10 },
  filtroAtivoTexto: { fontSize: 12.5, color: cores.cyanForte, fontWeight: '600' },
  listaTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  listaTitulo: {
    fontSize: 14.5,
    fontWeight: '700',
    color: cores.textoTitulo,
    flex: 1,
  },
  botaoBusca: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoBuscaTexto: { fontSize: 14 },
  buscaIconeTexto: { fontSize: 13 },
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    backgroundColor: cores.superficie,
  },
  buscaInput: {
    flex: 1,
    fontSize: 13.5,
    color: cores.texto,
    padding: 0,
  },
  vazioCard: {
    marginHorizontal: 18,
    backgroundColor: cores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  vazioIcone: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: cores.infoFundo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  vazioTitulo: { fontSize: 13.5, fontWeight: '700', color: cores.textoTitulo },
  vazioSubtitulo: {
    fontSize: 11.5,
    color: cores.textoMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabTexto: { color: '#fff', fontSize: 30, fontWeight: '400', marginTop: -2 },
});
