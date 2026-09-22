import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme/colors';

interface CondominioResumo {
  id: string;
  nome: string;
  bairro: string;
  status: 'CONCLUIDO' | 'PENDENTE' | 'ATRASADO';
  ultimaManutencao: string | null;
  numeroCameras: number;
}

interface DashboardResumo {
  condominios: {
    total: number;
    concluidos: number;
    pendentes: number;
    atrasados: number;
    lista: CondominioResumo[];
  };
}

type Filtro = 'TODOS' | 'CONCLUIDO' | 'PENDENTE' | 'ATRASADO';

const FILTROS: { label: string; valor: Filtro }[] = [
  { label: 'Todos', valor: 'TODOS' },
  { label: 'Concluído', valor: 'CONCLUIDO' },
  { label: 'Pendente', valor: 'PENDENTE' },
  { label: 'Atrasado', valor: 'ATRASADO' },
];

const CORES_STATUS: Record<CondominioResumo['status'], { cor: string; fundo: string; label: string }> = {
  CONCLUIDO: { cor: cores.sucesso, fundo: cores.sucessoFundo, label: 'Concluído' },
  PENDENTE: { cor: cores.aviso, fundo: cores.avisoFundo, label: 'Pendente' },
  ATRASADO: { cor: cores.perigo, fundo: cores.perigoFundo, label: 'Atrasado' },
};

function dataPorExtenso(): string {
  const hoje = new Date();
  return hoje.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function DashboardScreen({
  onSelecionarCondominio,
}: {
  onSelecionarCondominio: (condominio: CondominioResumo) => void;
}) {
  const { usuario } = useAuth();
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const carregar = useCallback(() => {
    setErro(null);
    return api
      .get<DashboardResumo>('/dashboard')
      .then(setResumo)
      .catch((e: ApiError) => setErro(e.message || 'Não foi possível carregar o resumo.'));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleRefresh() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? '';

  const buscaLower = busca.trim().toLowerCase();
  const lista = (resumo?.condominios.lista ?? [])
    .filter((c) => filtro === 'TODOS' || c.status === filtro)
    .filter(
      (c) =>
        !buscaLower ||
        c.nome.toLowerCase().includes(buscaLower) ||
        c.bairro.toLowerCase().includes(buscaLower),
    );

  const cards = resumo
    ? [
        { label: 'Condomínios', valor: resumo.condominios.total, cor: cores.navy },
        { label: 'Concluídas', valor: resumo.condominios.concluidos, cor: cores.sucesso },
        { label: 'Pendentes', valor: resumo.condominios.pendentes, cor: cores.aviso },
        { label: 'Atrasadas', valor: resumo.condominios.atrasados, cor: cores.perigo },
      ]
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.saudacao}>Olá, {primeiroNome}</Text>
        <Text style={styles.data}>{dataPorExtenso()}</Text>
      </View>

      {erro && (
        <View style={styles.erroBox}>
          <Text style={styles.erroTexto}>{erro}</Text>
        </View>
      )}

      {!resumo && !erro && <ActivityIndicator style={styles.loading} color={cores.cyan} />}

      {resumo && (
        <>
          <View style={styles.statsGrid}>
            {cards.map((card) => (
              <View key={card.label} style={styles.statCard}>
                <Text style={[styles.statValor, { color: card.cor }]}>{card.valor}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar condomínio…"
            placeholderTextColor={cores.textoMuted}
            style={styles.busca}
          />

          <View style={styles.chipsLinha}>
            {FILTROS.map((f) => (
              <TouchableOpacity
                key={f.valor}
                onPress={() => setFiltro(f.valor)}
                style={[styles.chip, filtro === f.valor && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, filtro === f.valor && styles.chipTextoAtivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          resumo ? <Text style={styles.vazio}>Nenhum condomínio encontrado.</Text> : null
        }
        renderItem={({ item }) => {
          const statusInfo = CORES_STATUS[item.status];
          return (
            <TouchableOpacity style={styles.card} onPress={() => onSelecionarCondominio(item)}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusInfo.fundo }]}>
                  <Text style={[styles.statusTexto, { color: statusInfo.cor }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDetalhe}>
                {item.bairro} · {item.numeroCameras} câmera(s)
              </Text>
              <Text style={styles.cardData}>
                {item.ultimaManutencao
                  ? `Última manutenção: ${new Date(item.ultimaManutencao).toLocaleDateString('pt-BR')}`
                  : 'Sem manutenção registrada'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: {
    backgroundColor: cores.navy,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  saudacao: { color: cores.textoOnDark, fontSize: 22, fontWeight: '800' },
  data: { color: cores.textoOnDarkMuted, fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  erroBox: { margin: 16, padding: 12, backgroundColor: cores.perigoFundo, borderRadius: 8 },
  erroTexto: { color: cores.perigo, fontSize: 13 },
  loading: { marginTop: 40 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 14,
  },
  statValor: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, color: cores.textoMuted, marginTop: 2, fontWeight: '600' },
  busca: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: cores.texto,
  },
  chipsLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.navy, borderColor: cores.navy },
  chipTexto: { fontSize: 12.5, color: cores.textoMuted, fontWeight: '600' },
  chipTextoAtivo: { color: '#fff' },
  lista: { padding: 16, gap: 10 },
  vazio: { textAlign: 'center', color: cores.textoMuted, marginTop: 30, fontSize: 14 },
  card: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 14,
    marginBottom: 10,
  },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNome: { fontSize: 15, fontWeight: '700', color: cores.textoTitulo, flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusTexto: { fontSize: 11, fontWeight: '700' },
  cardDetalhe: { fontSize: 12.5, color: cores.textoMuted, marginTop: 6 },
  cardData: { fontSize: 11.5, color: cores.textoMuted, marginTop: 4 },
});
