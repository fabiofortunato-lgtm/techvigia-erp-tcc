import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { cores } from '../theme/colors';

interface Condominio {
  id: string;
  nome: string;
}

interface Usuario {
  id: string;
  nome: string;
  perfil: string;
}

interface Equipamento {
  id: string;
  tipo: string;
  fabricante: string;
  modelo: string;
  local?: string | null;
}

const TIPOS = [
  { valor: 'PREVENTIVA', label: 'Preventiva' },
  { valor: 'CORRETIVA', label: 'Corretiva' },
];

const PRIORIDADES = [
  { valor: 'BAIXA', label: 'Baixa', cor: cores.textoMuted },
  { valor: 'MEDIA', label: 'Média', cor: cores.aviso },
  { valor: 'ALTA', label: 'Alta', cor: cores.perigo },
];

type Etapa = 1 | 2 | 3;

// Ignora acentos e maiúsculas/minúsculas na busca - "aldebaran" deve achar
// "ALDEBARAN" e "condomínio" deve achar "CONDOMINIO" sem acento.
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function NovaOsModal({
  visivel,
  onFechar,
  onCriada,
}: {
  visivel: boolean;
  onFechar: () => void;
  onCriada: (manutencaoId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [alturaTeclado, setAlturaTeclado] = useState(0);

  // KeyboardAvoidingView tem um comportamento conhecido de não funcionar
  // direito dentro de <Modal> no Android (a Modal roda como uma janela
  // separada, fora da árvore de layout principal onde o
  // KeyboardAvoidingView normalmente escuta os eventos de teclado).
  // Rastreando a altura manualmente aqui e aplicando como espaço extra
  // embaixo do cartão contorna esse problema.
  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', (e) => {
      setAlturaTeclado(e.endCoordinates.height);
    });
    const esconder = Keyboard.addListener('keyboardDidHide', () => {
      setAlturaTeclado(0);
    });
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);
  const [etapa, setEtapa] = useState<Etapa>(1);

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [carregandoListas, setCarregandoListas] = useState(false);
  const [carregandoEquipamentos, setCarregandoEquipamentos] = useState(false);

  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [buscaCondominio, setBuscaCondominio] = useState('');
  const [buscaTecnico, setBuscaTecnico] = useState('');
  const [tipo, setTipo] = useState('PREVENTIVA');
  const [prioridade, setPrioridade] = useState('MEDIA');

  const [equipamentoId, setEquipamentoId] = useState<string | null>(null);
  const [buscaEquipamento, setBuscaEquipamento] = useState('');

  const [descricaoDefeito, setDescricaoDefeito] = useState('');

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visivel) {
      setEtapa(1);
      setCondominioId(null);
      setTecnicoId(null);
      setBuscaCondominio('');
      setBuscaTecnico('');
      setTipo('PREVENTIVA');
      setPrioridade('MEDIA');
      setEquipamentoId(null);
      setBuscaEquipamento('');
      setDescricaoDefeito('');
      setEquipamentos([]);
      setCarregandoListas(true);
      Promise.all([api.get<Condominio[]>('/condominios'), api.get<Usuario[]>('/usuarios')])
        .then(([c, u]) => {
          setCondominios(c);
          setUsuarios(u);
        })
        .catch(() => Alert.alert('Erro', 'Não foi possível carregar condomínios/técnicos.'))
        .finally(() => setCarregandoListas(false));
    }
  }, [visivel]);

  // Busca os equipamentos só depois que o condomínio for escolhido, e só
  // quando o técnico avançar pra etapa 2 - evita uma chamada desnecessária
  // se ele nunca chegar a essa etapa (ex: cancelar antes).
  useEffect(() => {
    if (etapa === 2 && condominioId) {
      setCarregandoEquipamentos(true);
      api
        .get<Equipamento[]>(`/equipamentos/condominio/${condominioId}`)
        .then(setEquipamentos)
        .catch(() => setEquipamentos([]))
        .finally(() => setCarregandoEquipamentos(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, condominioId]);

  const condominiosFiltrados = condominios.filter((c) =>
    normalizar(c.nome).includes(normalizar(buscaCondominio)),
  );
  const usuariosFiltrados = usuarios.filter((u) =>
    normalizar(u.nome).includes(normalizar(buscaTecnico)),
  );
  const equipamentosFiltrados = equipamentos.filter((e) =>
    normalizar(`${e.tipo} ${e.fabricante} ${e.modelo} ${e.local ?? ''}`).includes(
      normalizar(buscaEquipamento),
    ),
  );

  const condominioSelecionado = condominios.find((c) => c.id === condominioId);
  const tecnicoSelecionado = usuarios.find((u) => u.id === tecnicoId);
  const equipamentoSelecionado = equipamentos.find((e) => e.id === equipamentoId);

  const podeAvancarEtapa1 = !!condominioId && !!tecnicoId;
  // Etapa 3 só existe de verdade pra Corretiva (campo de defeito
  // obrigatório) - Preventiva pula direto pra criação ao avançar da
  // etapa 2, então "pode criar" não depende de nada extra nesse caso.
  const podeCriar = tipo === 'CORRETIVA' ? descricaoDefeito.trim().length > 0 : true;

  function handleProximoEtapa1() {
    if (!podeAvancarEtapa1) return;
    setEtapa(2);
  }

  function handleProximoEtapa2() {
    if (tipo === 'CORRETIVA') {
      setEtapa(3);
    } else {
      handleCriar();
    }
  }

  async function handleCriar() {
    if (tipo === 'CORRETIVA' && !podeCriar) return;
    setSalvando(true);
    try {
      const manutencao = await api.post<{ id: string }>('/manutencoes', {
        condominioId,
        tecnicoId,
        tipo,
        prioridade,
        equipamentoId: equipamentoId || undefined,
        observacao: tipo === 'CORRETIVA' ? descricaoDefeito.trim() : undefined,
        inicio: new Date().toISOString(), // chamado avulso - abre já para "agora"
        chamadoAvulso: true,
      });
      onFechar();
      onCriada(manutencao.id);
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível criar a OS.');
    } finally {
      setSalvando(false);
    }
  }

  const titulos: Record<Etapa, string> = {
    1: 'Nova Ordem de Serviço',
    2: 'Equipamento (opcional)',
    3: 'Descrição do defeito',
  };

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <View style={[styles.overlay, { paddingBottom: alturaTeclado }]}>
        <View style={[styles.card, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoEsquerda}>
              {etapa > 1 && (
                <TouchableOpacity
                  onPress={() => setEtapa((e) => (e - 1) as Etapa)}
                  style={styles.voltarBotao}
                >
                  <Text style={styles.voltarTexto}>‹ Voltar</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.titulo}>{titulos[etapa]}</Text>
            </View>
            <TouchableOpacity onPress={onFechar}>
              <Text style={styles.fechar}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.indicadorEtapas}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[
                  styles.bolinhaEtapa,
                  n === etapa && styles.bolinhaEtapaAtiva,
                  n < etapa && styles.bolinhaEtapaFeita,
                ]}
              />
            ))}
          </View>

          {carregandoListas ? (
            <ActivityIndicator color={cores.cyan} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={styles.corpo}>
              {etapa === 1 && (
                <>
                  <Text style={styles.label}>Condomínio</Text>
                  <TextInput
                    style={styles.buscaInput}
                    placeholder="Buscar condomínio..."
                    placeholderTextColor={cores.textoMuted}
                    value={buscaCondominio}
                    onChangeText={setBuscaCondominio}
                  />
                  {condominioSelecionado && (
                    <Text style={styles.selecionadoTexto}>
                      Selecionado: {condominioSelecionado.nome}
                    </Text>
                  )}
                  <ScrollView style={styles.listaSelecao} nestedScrollEnabled>
                    {condominiosFiltrados.length === 0 && (
                      <Text style={styles.listaVazia}>Nenhum condomínio encontrado.</Text>
                    )}
                    {condominiosFiltrados.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.itemSelecao,
                          condominioId === c.id && styles.itemSelecaoAtivo,
                        ]}
                        onPress={() => {
                          setCondominioId(c.id);
                          setEquipamentoId(null); // trocou de condomínio, o equipamento escolhido antes não vale mais
                        }}
                      >
                        <Text
                          style={[
                            styles.itemSelecaoTexto,
                            condominioId === c.id && styles.itemSelecaoTextoAtivo,
                          ]}
                        >
                          {c.nome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Técnico responsável pelo atendimento</Text>
                  <TextInput
                    style={styles.buscaInput}
                    placeholder="Buscar técnico..."
                    placeholderTextColor={cores.textoMuted}
                    value={buscaTecnico}
                    onChangeText={setBuscaTecnico}
                  />
                  {tecnicoSelecionado && (
                    <Text style={styles.selecionadoTexto}>
                      Selecionado: {tecnicoSelecionado.nome}
                    </Text>
                  )}
                  <ScrollView style={styles.listaSelecao} nestedScrollEnabled>
                    {usuariosFiltrados.length === 0 && (
                      <Text style={styles.listaVazia}>Nenhum técnico encontrado.</Text>
                    )}
                    {usuariosFiltrados.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.itemSelecao, tecnicoId === u.id && styles.itemSelecaoAtivo]}
                        onPress={() => setTecnicoId(u.id)}
                      >
                        <Text
                          style={[
                            styles.itemSelecaoTexto,
                            tecnicoId === u.id && styles.itemSelecaoTextoAtivo,
                          ]}
                        >
                          {u.nome} ({u.perfil})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Tipo de chamado</Text>
                  <View style={styles.toggleLinha}>
                    {TIPOS.map((t) => (
                      <TouchableOpacity
                        key={t.valor}
                        style={[styles.toggleBotao, tipo === t.valor && styles.toggleBotaoAtivo]}
                        onPress={() => setTipo(t.valor)}
                      >
                        <Text
                          style={[
                            styles.toggleBotaoTexto,
                            tipo === t.valor && styles.toggleBotaoTextoAtivo,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Prioridade</Text>
                  <View style={styles.toggleLinha}>
                    {PRIORIDADES.map((p) => (
                      <TouchableOpacity
                        key={p.valor}
                        style={[
                          styles.toggleBotao,
                          prioridade === p.valor && { backgroundColor: p.cor, borderColor: p.cor },
                        ]}
                        onPress={() => setPrioridade(p.valor)}
                      >
                        <Text
                          style={[
                            styles.toggleBotaoTexto,
                            prioridade === p.valor && styles.toggleBotaoTextoAtivo,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.aviso}>
                    A OS é criada com data/hora de agora (chamado avulso). Para agendar uma data
                    futura, use o painel web.
                  </Text>
                </>
              )}

              {etapa === 2 && (
                <>
                  <Text style={styles.label}>
                    Qual equipamento? (opcional - pode pular direto pra próxima etapa)
                  </Text>
                  {carregandoEquipamentos ? (
                    <ActivityIndicator color={cores.cyan} style={{ marginVertical: 16 }} />
                  ) : (
                    <>
                      <TextInput
                        style={styles.buscaInput}
                        placeholder="Buscar equipamento..."
                        placeholderTextColor={cores.textoMuted}
                        value={buscaEquipamento}
                        onChangeText={setBuscaEquipamento}
                      />
                      {equipamentoSelecionado && (
                        <Text style={styles.selecionadoTexto}>
                          Selecionado: {equipamentoSelecionado.tipo} —{' '}
                          {equipamentoSelecionado.fabricante} {equipamentoSelecionado.modelo}
                        </Text>
                      )}
                      <ScrollView style={styles.listaSelecaoGrande} nestedScrollEnabled>
                        {equipamentosFiltrados.length === 0 && (
                          <Text style={styles.listaVazia}>
                            Nenhum equipamento cadastrado nesse condomínio ainda.
                          </Text>
                        )}
                        {equipamentosFiltrados.map((e) => (
                          <TouchableOpacity
                            key={e.id}
                            style={[
                              styles.itemSelecao,
                              equipamentoId === e.id && styles.itemSelecaoAtivo,
                            ]}
                            onPress={() =>
                              setEquipamentoId(equipamentoId === e.id ? null : e.id)
                            }
                          >
                            <Text
                              style={[
                                styles.itemSelecaoTexto,
                                equipamentoId === e.id && styles.itemSelecaoTextoAtivo,
                              ]}
                            >
                              {e.tipo} — {e.fabricante} {e.modelo}
                              {e.local ? ` (${e.local})` : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </>
              )}

              {etapa === 3 && (
                <>
                  <Text style={styles.label}>Descreva o defeito encontrado</Text>
                  <TextInput
                    style={styles.defeitoInput}
                    placeholder="Ex.: câmera sem imagem, DVR não grava, cabo rompido..."
                    placeholderTextColor={cores.textoMuted}
                    value={descricaoDefeito}
                    onChangeText={setDescricaoDefeito}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                </>
              )}
            </ScrollView>
          )}

          {etapa === 1 && (
            <TouchableOpacity
              style={[styles.botaoCriar, !podeAvancarEtapa1 && styles.botaoCriarDesabilitado]}
              onPress={handleProximoEtapa1}
              disabled={!podeAvancarEtapa1}
            >
              <Text style={styles.botaoCriarTexto}>Próximo</Text>
            </TouchableOpacity>
          )}

          {etapa === 2 && (
            <TouchableOpacity style={styles.botaoCriar} onPress={handleProximoEtapa2}>
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoCriarTexto}>
                  {tipo === 'CORRETIVA' ? 'Próximo' : 'Criar Ordem de Serviço'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {etapa === 3 && (
            <TouchableOpacity
              style={[styles.botaoCriar, !podeCriar && styles.botaoCriarDesabilitado]}
              onPress={handleCriar}
              disabled={!podeCriar || salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoCriarTexto}>Criar Ordem de Serviço</Text>
              )}
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
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: cores.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cabecalhoEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  voltarBotao: { paddingVertical: 2 },
  voltarTexto: { fontSize: 14, color: cores.cyanForte, fontWeight: '600' },
  titulo: { fontSize: 17, fontWeight: '700', color: cores.textoTitulo, flexShrink: 1 },
  fechar: { fontSize: 16, color: cores.textoMuted, padding: 4 },
  indicadorEtapas: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  bolinhaEtapa: { flex: 1, height: 4, borderRadius: 2, backgroundColor: cores.borda },
  bolinhaEtapaAtiva: { backgroundColor: cores.cyan },
  bolinhaEtapaFeita: { backgroundColor: cores.cyanClaro },
  corpo: {},
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: cores.textoMuted,
    marginBottom: 8,
    marginTop: 14,
  },
  buscaInput: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: cores.texto,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  defeitoInput: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: cores.texto,
    backgroundColor: '#fff',
    minHeight: 120,
  },
  selecionadoTexto: {
    fontSize: 12,
    color: cores.cyanForte,
    fontWeight: '600',
    marginBottom: 8,
  },
  listaVazia: {
    fontSize: 12.5,
    color: cores.textoMuted,
    paddingVertical: 10,
    textAlign: 'center',
  },
  listaSelecao: { maxHeight: 140, overflow: 'hidden' },
  listaSelecaoGrande: { maxHeight: 320, overflow: 'hidden' },
  itemSelecao: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  itemSelecaoAtivo: { backgroundColor: cores.cyanClaro, borderColor: cores.cyan },
  itemSelecaoTexto: { fontSize: 13.5, color: cores.texto },
  itemSelecaoTextoAtivo: { color: cores.cyanForte, fontWeight: '700' },
  toggleLinha: { flexDirection: 'row', gap: 8 },
  toggleBotao: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBotaoAtivo: { backgroundColor: cores.navy, borderColor: cores.navy },
  toggleBotaoTexto: { fontSize: 13, fontWeight: '600', color: cores.textoMuted },
  toggleBotaoTextoAtivo: { color: '#fff' },
  aviso: { fontSize: 11.5, color: cores.textoMuted, marginTop: 16, lineHeight: 16, opacity: 0.8 },
  botaoCriar: {
    marginTop: 16,
    backgroundColor: cores.cyan,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoCriarDesabilitado: { backgroundColor: cores.borda },
  botaoCriarTexto: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});
