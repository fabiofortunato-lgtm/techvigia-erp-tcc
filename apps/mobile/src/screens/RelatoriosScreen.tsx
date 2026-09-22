import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api, ApiError } from '../api/client';
import { cores } from '../theme/colors';
import { IconBarChart, IconDonut } from '../theme/icons';

interface OsPorTecnico {
  tecnicoId: string;
  tecnicoNome: string;
  total: number;
  concluidas: number;
}

interface DashboardResumo {
  ordensServico: {
    abertas: number;
    emAndamento: number;
    atrasadas: number;
    concluidas: number;
    total: number;
  };
}

interface Condominio {
  id: string;
  nome: string;
}

const RAIO_DONUT = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO_DONUT;

// Ignora acentos e maiúsculas/minúsculas na busca - "sao" deve achar "São
// Conrado" e "STADIUM" deve achar "Stadium Offices".
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function RelatoriosScreen() {
  const [osPorTecnico, setOsPorTecnico] = useState<OsPorTecnico[] | null>(null);
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioSelecionadoId, setCondominioSelecionadoId] = useState<string | null>(null);
  const [mostrarSeletor, setMostrarSeletor] = useState(false);
  const [buscaCondominio, setBuscaCondominio] = useState('');

  useEffect(() => {
    api.get<Condominio[]>('/condominios').then(setCondominios).catch(() => setCondominios([]));
  }, []);

  function carregar() {
    setErro(null);
    const sufixo = condominioSelecionadoId
      ? `?condominioId=${condominioSelecionadoId}`
      : '';
    return Promise.all([
      api.get<OsPorTecnico[]>(`/relatorios/os-por-tecnico${sufixo}`),
      api.get<DashboardResumo>(`/dashboard${sufixo}`),
    ])
      .then(([tecnicos, dashboard]) => {
        setOsPorTecnico(tecnicos);
        setResumo(dashboard);
      })
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar os relatórios.'));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioSelecionadoId]);

  async function handleRefresh() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const carregando = !osPorTecnico || !resumo;
  const maiorTotal = osPorTecnico ? Math.max(1, ...osPorTecnico.map((t) => t.total)) : 1;

  const segmentosPrazo = resumo
    ? [
        { label: 'Concluídas', valor: resumo.ordensServico.concluidas, cor: cores.sucesso },
        { label: 'Em execução', valor: resumo.ordensServico.emAndamento, cor: cores.aviso },
        { label: 'Abertas', valor: resumo.ordensServico.abertas, cor: cores.info },
        { label: 'Atrasadas', valor: resumo.ordensServico.atrasadas, cor: cores.perigo },
      ]
    : [];
  const totalPrazo = resumo?.ordensServico.total || 1;

  let acumulado = 0;

  const condominioSelecionado = condominios.find((c) => c.id === condominioSelecionadoId);
  const condominiosFiltrados = condominios.filter((c) =>
    normalizar(c.nome).includes(normalizar(buscaCondominio)),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>Relatórios</Text>
        <TouchableOpacity style={styles.botaoFiltro} onPress={() => setMostrarSeletor(true)}>
          <Text style={styles.botaoFiltroTexto} numberOfLines={1}>
            {condominioSelecionado ? condominioSelecionado.nome : 'Todos os locais'} ▾
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={mostrarSeletor}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarSeletor(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMostrarSeletor(false);
            setBuscaCondominio('');
          }}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Filtrar por local de atendimento</Text>
            <TextInput
              style={styles.modalBusca}
              placeholder="Digite as iniciais do condomínio..."
              placeholderTextColor={cores.textoMuted}
              value={buscaCondominio}
              onChangeText={setBuscaCondominio}
              autoFocus
            />
            <ScrollView style={styles.modalLista}>
              {!buscaCondominio.trim() && (
                <TouchableOpacity
                  style={[styles.modalItem, !condominioSelecionadoId && styles.modalItemAtivo]}
                  onPress={() => {
                    setCondominioSelecionadoId(null);
                    setMostrarSeletor(false);
                    setBuscaCondominio('');
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemTexto,
                      !condominioSelecionadoId && styles.modalItemTextoAtivo,
                    ]}
                  >
                    Todos os locais
                  </Text>
                </TouchableOpacity>
              )}
              {condominiosFiltrados.length === 0 && (
                <Text style={styles.modalVazio}>Nenhum condomínio encontrado.</Text>
              )}
              {condominiosFiltrados.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.modalItem,
                    condominioSelecionadoId === c.id && styles.modalItemAtivo,
                  ]}
                  onPress={() => {
                    setCondominioSelecionadoId(c.id);
                    setMostrarSeletor(false);
                    setBuscaCondominio('');
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemTexto,
                      condominioSelecionadoId === c.id && styles.modalItemTextoAtivo,
                    ]}
                  >
                    {c.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handleRefresh} />}
      >
        {erro && (
          <View style={styles.erroBox}>
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        )}

        {carregando && !erro && <ActivityIndicator color={cores.cyan} style={{ marginTop: 40 }} />}

        {!carregando && (
          <>
            {/* Cumprimento de prazo */}
            <View style={styles.card}>
              <View style={styles.cardTituloLinha}>
                <View style={[styles.cardIcone, { backgroundColor: cores.sucessoFundo }]}>
                  <IconDonut size={15} color={cores.sucesso} />
                </View>
                <Text style={styles.cardTitulo}>Cumprimento de prazo</Text>
              </View>

              <View style={styles.donutLinha}>
                <Svg width={124} height={124} viewBox="0 0 124 124" style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={62} cy={62} r={RAIO_DONUT} stroke={cores.borda} strokeWidth={16} fill="none" />
                  {segmentosPrazo.map((seg) => {
                    const comprimento = (seg.valor / totalPrazo) * CIRCUNFERENCIA;
                    const offset = -acumulado;
                    acumulado += comprimento;
                    if (seg.valor === 0) return null;
                    return (
                      <Circle
                        key={seg.label}
                        cx={62}
                        cy={62}
                        r={RAIO_DONUT}
                        stroke={seg.cor}
                        strokeWidth={16}
                        fill="none"
                        strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
                        strokeDashoffset={offset}
                      />
                    );
                  })}
                </Svg>

                <View style={styles.legenda}>
                  {segmentosPrazo.map((seg) => (
                    <View key={seg.label} style={styles.legendaItem}>
                      <View style={[styles.legendaBolinha, { backgroundColor: seg.cor }]} />
                      <Text style={styles.legendaLabel}>{seg.label}</Text>
                      <Text style={styles.legendaValor}>{seg.valor}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* OS por técnico */}
            <View style={styles.card}>
              <View style={styles.cardTituloLinha}>
                <View style={[styles.cardIcone, { backgroundColor: cores.infoFundo }]}>
                  <IconBarChart size={15} color={cores.info} />
                </View>
                <Text style={styles.cardTitulo}>OS por técnico</Text>
              </View>

              {osPorTecnico && osPorTecnico.length === 0 && (
                <Text style={styles.vazioTexto}>Nenhuma OS atribuída a técnicos ainda.</Text>
              )}

              {osPorTecnico?.map((t) => (
                <View key={t.tecnicoId} style={styles.barraLinha}>
                  <View style={styles.barraCabecalho}>
                    <Text style={styles.barraLabel} numberOfLines={1}>
                      {t.tecnicoNome}
                    </Text>
                    <Text style={styles.barraValor}>
                      {t.concluidas}/{t.total}
                    </Text>
                  </View>
                  <View style={styles.barraTrilho}>
                    <View
                      style={[
                        styles.barraPreenchimento,
                        { width: `${(t.total / maiorTotal) * 100}%`, backgroundColor: cores.info },
                      ]}
                    />
                    <View
                      style={[
                        styles.barraPreenchimentoConcluidas,
                        { width: `${(t.concluidas / maiorTotal) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.legendaBarras}>
                <View style={styles.legendaBarrasItem}>
                  <View style={[styles.legendaBolinha, { backgroundColor: cores.sucesso }]} />
                  <Text style={styles.legendaLabel}>Concluídas</Text>
                </View>
                <View style={styles.legendaBarrasItem}>
                  <View style={[styles.legendaBolinha, { backgroundColor: cores.info }]} />
                  <Text style={styles.legendaLabel}>Total atribuído</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: {
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: cores.textoTitulo },
  botaoFiltro: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 170,
  },
  botaoFiltroTexto: { fontSize: 12, fontWeight: '600', color: cores.cyanForte },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20,22,26,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: cores.superficie,
    borderRadius: 16,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitulo: { fontSize: 15, fontWeight: '700', color: cores.textoTitulo, marginBottom: 12 },
  modalBusca: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: cores.texto,
    marginBottom: 10,
  },
  modalVazio: {
    fontSize: 12.5,
    color: cores.textoMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalLista: {},
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalItemAtivo: { backgroundColor: cores.cyanClaro },
  modalItemTexto: { fontSize: 14, color: cores.texto },
  modalItemTextoAtivo: { color: cores.cyanForte, fontWeight: '700' },
  conteudo: { padding: 18, paddingBottom: 90, gap: 14 },
  erroBox: { padding: 12, backgroundColor: cores.perigoFundo, borderRadius: 8 },
  erroTexto: { color: cores.perigo, fontSize: 13 },
  card: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    padding: 16,
  },
  cardTituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcone: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontSize: 14.5, fontWeight: '700', color: cores.textoTitulo },
  vazioTexto: { fontSize: 12.5, color: cores.textoMuted },

  donutLinha: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  legenda: { flex: 1, gap: 8 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaBolinha: { width: 8, height: 8, borderRadius: 4 },
  legendaLabel: { fontSize: 12, color: cores.texto, flex: 1 },
  legendaValor: { fontSize: 12, color: cores.textoMuted, fontWeight: '700' },

  barraLinha: { marginBottom: 12 },
  barraCabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barraLabel: { fontSize: 12.5, color: cores.texto, flex: 1, marginRight: 8 },
  barraValor: { fontSize: 12, color: cores.textoMuted, fontWeight: '700' },
  barraTrilho: { height: 8, backgroundColor: cores.fundo, borderRadius: 4, overflow: 'hidden' },
  barraPreenchimento: { position: 'absolute', height: '100%', borderRadius: 4 },
  barraPreenchimentoConcluidas: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
    backgroundColor: cores.sucesso,
  },
  legendaBarras: { flexDirection: 'row', gap: 16, marginTop: 4 },
  legendaBarrasItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
