import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, ErroDeRede } from '../api/client';
import { enfileirarJson, enfileirarArquivo } from '../offline/queue';
import { cores } from '../theme/colors';
import { IconChevronRight, IconCheckCircle } from '../theme/icons';

interface ChecklistItem {
  id: string;
  item: string;
  status: string;
  observacao?: string | null;
}

interface Foto {
  id: string;
  arquivoUrl: string;
  tipo: 'ANTES' | 'DEPOIS';
}

interface Peca {
  id: string;
  nome: string;
  quantidade: number;
  motivoTroca?: string | null;
}

interface ManutencaoDetalhe {
  id: string;
  numeroOS: string;
  status: string;
  inicio: string | null;
  fim?: string | null;
  observacao?: string | null;
  latitudeCheckin?: number | null;
  longitudeCheckin?: number | null;
  condominio: { nome: string; endereco: string };
  tecnico: { nome: string };
  checklist: ChecklistItem[];
  fotos: Foto[];
  pecas: Peca[];
  assinaturaUrl: string | null;
  assinanteNome?: string | null;
  pdfUrl: string | null;
}

// Foto tirada offline, ainda não confirmada pelo servidor - existe só
// localmente até a fila conseguir enviar de verdade.
interface FotoPendenteLocal {
  id: string;
  tipo: 'ANTES' | 'DEPOIS';
  uriLocal: string;
}

// Assinatura coletada offline, ainda não confirmada pelo servidor.
interface AssinaturaPendenteLocal {
  base64: string;
  nomeAssinante: string;
}

const STATUS_OPCOES = ['OK', 'DEFEITO', 'NAO_APLICAVEL'];

const ETAPAS = ['Detalhe', 'Checklist', 'Assinatura', 'Conclusão'];

const CHECKLIST_SUGESTOES = [
  'DVR ligando normalmente',
  'Câmeras gravando corretamente',
  'Cabeamento sem danos aparentes',
  'Fonte de alimentação estável',
  'HD sem ruído ou travamento',
  'Data/hora sincronizada no DVR',
  'Lentes limpas e sem obstrução',
  'Conexão de rede/internet estável',
];

const PECAS_SUGESTOES = [
  'Fonte de alimentação',
  'Cabo de rede (metro)',
  'Conector RJ45',
  'Câmera (unidade)',
  'HD para DVR/NVR',
  'Suporte de fixação',
  'Cabo coaxial',
  'No-break',
];

const ASSINATURA_WEBSTYLE = `
  .m-signature-pad--footer {
    display: none !important;
  }
  body, html {
    width: 100%;
    height: 100%;
  }
`;

// Pasta persistente pra fotos tiradas offline - diferente do cache
// temporário do ImagePicker, que o sistema operacional pode apagar a
// qualquer momento (inclusive entre uma sessão do app e outra). Enquanto a
// foto não é confirmada pelo servidor, ela precisa sobreviver aqui.
const PASTA_FOTOS_PENDENTES = `${FileSystem.documentDirectory}fotos-pendentes/`;

async function garantirPastaFotosPendentes() {
  const info = await FileSystem.getInfoAsync(PASTA_FOTOS_PENDENTES);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PASTA_FOTOS_PENDENTES, { intermediates: true });
  }
}

function chaveCache(manutencaoId: string) {
  return `scantech_cache_manutencao_${manutencaoId}`;
}

interface CachePayload {
  manutencao: ManutencaoDetalhe;
  fotosPendentesLocais: FotoPendenteLocal[];
  assinaturaPendenteLocal: AssinaturaPendenteLocal | null;
}

async function salvarCache(manutencaoId: string, payload: CachePayload) {
  try {
    await AsyncStorage.setItem(chaveCache(manutencaoId), JSON.stringify(payload));
  } catch {
    // Falha ao salvar cache local não deveria travar o fluxo principal -
    // na pior das hipóteses, a próxima abertura sem rede não terá cache.
  }
}

async function lerCache(manutencaoId: string): Promise<CachePayload | null> {
  try {
    const json = await AsyncStorage.getItem(chaveCache(manutencaoId));
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export function ManutencaoDetalheScreen({
  manutencaoId,
  onVoltar,
}: {
  manutencaoId: string;
  onVoltar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [manutencao, setManutencao] = useState<ManutencaoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exibindoDadosOffline, setExibindoDadosOffline] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);
  const [mostrarAssinatura, setMostrarAssinatura] = useState(false);
  const [assinanteNome, setAssinanteNome] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [compartilhandoPdf, setCompartilhandoPdf] = useState(false);

  // Checklist
  const [itemTexto, setItemTexto] = useState('');
  const [itemStatus, setItemStatus] = useState('OK');
  const [salvandoItem, setSalvandoItem] = useState(false);

  // Peças
  const [pecaNome, setPecaNome] = useState('');
  const [pecaQuantidade, setPecaQuantidade] = useState('1');
  const [pecaMotivo, setPecaMotivo] = useState('');
  const [salvandoPeca, setSalvandoPeca] = useState(false);

  // Observações
  const [observacoes, setObservacoes] = useState('');
  const [observacoesCarregadas, setObservacoesCarregadas] = useState(false);
  const [salvandoObservacoes, setSalvandoObservacoes] = useState(false);

  // Fotos
  const [enviandoFoto, setEnviandoFoto] = useState<'ANTES' | 'DEPOIS' | null>(null);
  const [fotosPendentesLocais, setFotosPendentesLocais] = useState<FotoPendenteLocal[]>([]);

  // Assinatura offline
  const [assinaturaPendenteLocal, setAssinaturaPendenteLocal] =
    useState<AssinaturaPendenteLocal | null>(null);

  const assinaturaRef = useRef<SignatureViewRef>(null);

  // Persiste o estado local (manutenção + pendências locais) no cache -
  // chamado toda vez que alguma dessas coisas muda, pra sobreviver a um
  // fechamento do app enquanto ainda offline.
  const persistirCache = useCallback(
    (dados: ManutencaoDetalhe, fotos: FotoPendenteLocal[], assinatura: AssinaturaPendenteLocal | null) => {
      salvarCache(manutencaoId, {
        manutencao: dados,
        fotosPendentesLocais: fotos,
        assinaturaPendenteLocal: assinatura,
      });
    },
    [manutencaoId],
  );

  // Carrega do servidor. Se a rede falhar, cai pro cache local em vez de
  // travar a tela inteira numa mensagem de erro - é a diferença entre "o
  // técnico consegue continuar trabalhando offline" e "o app trava assim
  // que o sinal cai no meio da casa de máquinas".
  const carregar = useCallback(() => {
    setErro(null);
    return api
      .get<ManutencaoDetalhe>(`/manutencoes/${manutencaoId}`)
      .then((dados) => {
        setManutencao(dados);
        setExibindoDadosOffline(false);
        // Dado fresco do servidor sempre supera qualquer pendência local
        // que já tenha sido sincronizada por fora (ex: pelo Modal de
        // Sincronização, disparado a partir de outra tela).
        setFotosPendentesLocais([]);
        setAssinaturaPendenteLocal(null);
        persistirCache(dados, [], null);
        if (!observacoesCarregadas) {
          setObservacoes(dados.observacao ?? '');
          setObservacoesCarregadas(true);
        }
      })
      .catch(async (e) => {
        if (e instanceof ErroDeRede) {
          const cache = await lerCache(manutencaoId);
          if (cache) {
            setManutencao(cache.manutencao);
            setFotosPendentesLocais(cache.fotosPendentesLocais);
            setAssinaturaPendenteLocal(cache.assinaturaPendenteLocal);
            setExibindoDadosOffline(true);
            if (!observacoesCarregadas) {
              setObservacoes(cache.manutencao.observacao ?? '');
              setObservacoesCarregadas(true);
            }
            return;
          }
        }
        setErro(
          e instanceof ErroDeRede
            ? 'Sem conexão e nenhum dado salvo no aparelho ainda para esta OS.'
            : (e as ApiError).message || 'Não foi possível carregar a OS.',
        );
      });
  }, [manutencaoId, observacoesCarregadas, persistirCache]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Aplica uma mudança no estado local (sem depender de recarregar do
  // servidor) e já persiste no cache. Usado depois de toda ação bem
  // sucedida - seja ela enviada de verdade ou só enfileirada offline -
  // pra tela nunca precisar de uma nova ida à rede só pra continuar
  // mostrando o que o técnico acabou de fazer.
  function atualizarLocalmente(atualizar: (atual: ManutencaoDetalhe) => ManutencaoDetalhe) {
    setManutencao((atual) => {
      if (!atual) return atual;
      const novo = atualizar(atual);
      persistirCache(novo, fotosPendentesLocais, assinaturaPendenteLocal);
      return novo;
    });
  }

  async function handleCheckin() {
    setFazendoCheckin(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da localização para registrar o check-in.');
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({});
      const body = {
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      };

      try {
        await api.post(`/manutencoes/${manutencaoId}/checkin`, body);
      } catch (e) {
        if (e instanceof ErroDeRede) {
          await enfileirarJson({
            path: `/manutencoes/${manutencaoId}/checkin`,
            body,
            descricao: `Check-in de ${manutencao?.condominio.nome ?? 'visita'}`,
          });
          Alert.alert(
            'Sem conexão',
            'Check-in salvo no aparelho e será enviado assim que a conexão voltar.',
          );
        } else {
          throw e;
        }
      }

      // Atualiza a tela na hora, sem depender de uma nova ida ao servidor -
      // funciona tanto no caminho online quanto no offline.
      atualizarLocalmente((atual) => ({
        ...atual,
        status: 'EM_ANDAMENTO',
        latitudeCheckin: body.latitude,
        longitudeCheckin: body.longitude,
      }));
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível fazer o check-in.');
    } finally {
      setFazendoCheckin(false);
    }
  }

  async function handleAdicionarChecklist() {
    if (!itemTexto.trim()) return;

    setSalvandoItem(true);
    const body = { item: itemTexto, status: itemStatus };

    try {
      let itemCriado: ChecklistItem | null = null;
      try {
        itemCriado = await api.post<ChecklistItem>(`/manutencoes/${manutencaoId}/checklist`, body);
      } catch (e) {
        if (e instanceof ErroDeRede) {
          const idLocal = `local-${Date.now()}`;
          await enfileirarJson({
            path: `/manutencoes/${manutencaoId}/checklist`,
            body,
            descricao: `Checklist: ${itemTexto}`,
          });
          itemCriado = { id: idLocal, item: itemTexto, status: itemStatus };
          Alert.alert('Sem conexão', 'Item salvo no aparelho e será enviado depois.');
        } else {
          throw e;
        }
      }

      if (itemCriado) {
        const novoItem = itemCriado;
        atualizarLocalmente((atual) => ({ ...atual, checklist: [...atual.checklist, novoItem] }));
      }

      setItemTexto('');
      setItemStatus('OK');
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível salvar o item.');
    } finally {
      setSalvandoItem(false);
    }
  }

  async function handleAdicionarPeca() {
    if (!pecaNome.trim()) return;

    setSalvandoPeca(true);
    const body = {
      nome: pecaNome,
      quantidade: Number(pecaQuantidade) || 1,
      motivoTroca: pecaMotivo || undefined,
    };

    try {
      let pecaCriada: Peca | null = null;
      try {
        pecaCriada = await api.post<Peca>(`/manutencoes/${manutencaoId}/pecas`, body);
      } catch (e) {
        if (e instanceof ErroDeRede) {
          const idLocal = `local-${Date.now()}`;
          await enfileirarJson({
            path: `/manutencoes/${manutencaoId}/pecas`,
            body,
            descricao: `Pedido: ${pecaNome}`,
          });
          pecaCriada = {
            id: idLocal,
            nome: pecaNome,
            quantidade: Number(pecaQuantidade) || 1,
            motivoTroca: pecaMotivo || null,
          };
          Alert.alert('Sem conexão', 'Peça salva no aparelho e será enviada depois.');
        } else {
          throw e;
        }
      }

      if (pecaCriada) {
        const novaPeca = pecaCriada;
        atualizarLocalmente((atual) => ({ ...atual, pecas: [...atual.pecas, novaPeca] }));
      }

      setPecaNome('');
      setPecaQuantidade('1');
      setPecaMotivo('');
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível salvar a peça.');
    } finally {
      setSalvandoPeca(false);
    }
  }

  // Retorna true se salvou (ou já não tinha nada pendente pra salvar).
  // `mostrarAlerta` controla se aparece um Alert de confirmação - usado só
  // quando o técnico aperta o botão "Salvar observações" de propósito;
  // quando chamado automaticamente antes de gerar o PDF, fica silencioso
  // (o próprio "Pronto" do PDF já serve de confirmação).
  async function salvarObservacoesPendentes(mostrarAlerta: boolean): Promise<boolean> {
    if (observacoes === (manutencao?.observacao ?? '')) return true; // nada mudou
    const body = { observacao: observacoes };
    try {
      await api.patch(`/manutencoes/${manutencaoId}/observacao`, body);
      if (mostrarAlerta) Alert.alert('Pronto', 'Observações salvas.');
    } catch (e) {
      if (e instanceof ErroDeRede) {
        await enfileirarJson({
          path: `/manutencoes/${manutencaoId}/observacao`,
          metodo: 'PATCH',
          body,
          descricao: 'Observações da OS',
        });
        if (mostrarAlerta) {
          Alert.alert('Sem conexão', 'Observações salvas no aparelho e serão enviadas depois.');
        }
      } else {
        if (mostrarAlerta) {
          Alert.alert(
            'Erro',
            e instanceof ApiError ? e.message : 'Não foi possível salvar as observações.',
          );
        }
        return false;
      }
    }
    atualizarLocalmente((atual) => ({ ...atual, observacao: observacoes }));
    return true;
  }

  async function handleSalvarObservacoes() {
    setSalvandoObservacoes(true);
    await salvarObservacoesPendentes(true);
    setSalvandoObservacoes(false);
  }

  async function handleCompartilharWhatsApp() {
    if (!manutencao?.pdfUrl) return;

    setCompartilhandoPdf(true);
    try {
      // Baixa o PDF pro aparelho com um nome limpo (sem o prefixo UUID do
      // armazenamento interno) - depois compartilha o ARQUIVO de verdade,
      // não um link. Antes mandava só um texto com link pro WhatsApp; isso
      // aparecia como uma mensagem de texto qualquer, não como um
      // documento anexado de verdade.
      const nomeArquivo = `${manutencao.numeroOS}.pdf`;
      const destino = `${FileSystem.cacheDirectory}${nomeArquivo}`;
      const { uri } = await FileSystem.downloadAsync(manutencao.pdfUrl, destino);

      const disponivel = await Sharing.isAvailableAsync();
      if (!disponivel) {
        Alert.alert('Erro', 'Compartilhamento não disponível neste aparelho.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Ordem de Serviço ${manutencao.numeroOS}`,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível baixar/compartilhar o PDF.');
    } finally {
      setCompartilhandoPdf(false);
    }
  }

  function handleAdicionarFoto(tipo: 'ANTES' | 'DEPOIS') {
    if (enviandoFoto === tipo) return;
    Alert.alert('Adicionar foto', 'De onde vem a foto?', [
      { text: 'Tirar com a câmera', onPress: () => capturarFoto(tipo, 'camera') },
      { text: 'Escolher da galeria', onPress: () => capturarFoto(tipo, 'galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function capturarFoto(tipo: 'ANTES' | 'DEPOIS', origem: 'camera' | 'galeria') {
    let resultado: ImagePicker.ImagePickerResult;

    if (origem === 'camera') {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão negada', 'Precisamos da câmera para tirar a foto.');
        return;
      }
      resultado = await ImagePicker.launchCameraAsync({
        quality: 0.6, // já comprime na captura - evita repetir o problema de "arquivo grande demais"
      });
    } else {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão negada', 'Precisamos de acesso às fotos para escolher da galeria.');
        return;
      }
      resultado = await ImagePicker.launchImageLibraryAsync({
        quality: 0.6,
      });
    }

    if (resultado.canceled || !resultado.assets?.[0]) return;

    const foto = resultado.assets[0];
    const nomeArquivo = foto.fileName ?? `foto-${tipo}-${Date.now()}.jpg`;

    setEnviandoFoto(tipo);
    try {
      // Sempre copia pra uma pasta persistente do app ANTES de tentar
      // enviar - o cache temporário do ImagePicker pode ser apagado pelo
      // sistema operacional a qualquer momento, inclusive antes da fila
      // offline conseguir reenviar a foto depois.
      await garantirPastaFotosPendentes();
      const idLocal = `local-${Date.now()}`;
      const uriPersistente = `${PASTA_FOTOS_PENDENTES}${idLocal}.jpg`;
      await FileSystem.copyAsync({ from: foto.uri, to: uriPersistente });

      try {
        const fotoCriada = await api.postArquivo<Foto>(
          `/manutencoes/${manutencaoId}/fotos`,
          { tipo },
          { uri: uriPersistente, name: nomeArquivo, type: 'image/jpeg' },
        );
        atualizarLocalmente((atual) => ({ ...atual, fotos: [...atual.fotos, fotoCriada] }));
        // Já foi enviada de verdade - não precisa mais da cópia local.
        await FileSystem.deleteAsync(uriPersistente, { idempotent: true });
      } catch (e) {
        if (e instanceof ErroDeRede) {
          await enfileirarArquivo({
            path: `/manutencoes/${manutencaoId}/fotos`,
            campos: { tipo },
            arquivoUriLocal: uriPersistente,
            arquivoNome: nomeArquivo,
            arquivoMime: 'image/jpeg',
            descricao: `Foto ${tipo === 'ANTES' ? 'Antes' : 'Depois'} da manutenção`,
          });
          setFotosPendentesLocais((atuais) => {
            const novas = [...atuais, { id: idLocal, tipo, uriLocal: uriPersistente }];
            if (manutencao) persistirCache(manutencao, novas, assinaturaPendenteLocal);
            return novas;
          });
          Alert.alert(
            'Sem conexão',
            'Foto salva no aparelho e será enviada assim que a conexão voltar.',
          );
        } else {
          throw e;
        }
      }
    } catch (e) {
      Alert.alert(
        'Erro',
        e instanceof ApiError ? e.message : 'Não foi possível processar a foto.',
      );
    } finally {
      setEnviandoFoto(null);
    }
  }

  async function handleSalvarAssinatura(assinaturaBase64: string) {
    // Última chance de salvar a observação antes da trava - depois de
    // assinada, a OS não aceita mais edição de observação
    // (verificarNaoTravada no backend). O técnico pode ter escrito algo
    // e assumido que assinar/finalizar já incluía tudo.
    await salvarObservacoesPendentes(false);

    const body = { imagemBase64: assinaturaBase64, nomeAssinante: assinanteNome.trim() };

    try {
      const atualizada = await api.post<ManutencaoDetalhe>(
        `/manutencoes/${manutencaoId}/assinatura`,
        body,
      );
      setMostrarAssinatura(false);
      atualizarLocalmente((atual) => ({
        ...atual,
        assinaturaUrl: atualizada.assinaturaUrl,
        assinanteNome: atualizada.assinanteNome,
      }));
    } catch (e) {
      if (e instanceof ErroDeRede) {
        await enfileirarJson({
          path: `/manutencoes/${manutencaoId}/assinatura`,
          body,
          descricao: `Assinatura de ${assinanteNome.trim()}`,
        });
        setMostrarAssinatura(false);
        const pendente = { base64: assinaturaBase64, nomeAssinante: assinanteNome.trim() };
        setAssinaturaPendenteLocal(pendente);
        if (manutencao) persistirCache(manutencao, fotosPendentesLocais, pendente);
        Alert.alert(
          'Sem conexão',
          'Assinatura salva no aparelho e será enviada assim que a conexão voltar. Você já pode continuar o fechamento da OS.',
        );
        return;
      }
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível salvar a assinatura.');
    }
  }

  async function handleGerarPdf() {
    setGerandoPdf(true);
    try {
      const atualizada = await api.post<ManutencaoDetalhe>(`/manutencoes/${manutencaoId}/gerar-pdf`);
      // Mescla só os campos que essa rota de fato muda, em vez de
      // substituir o objeto inteiro - protege contra qualquer resposta
      // parcial do backend (checklist/fotos/pecas ausentes), que já
      // causou uma tela quebrando ao tentar filtrar undefined.
      atualizarLocalmente((atual) => ({
        ...atual,
        status: atualizada.status,
        pdfUrl: atualizada.pdfUrl,
        fim: atualizada.fim,
      }));
    } catch (e) {
      Alert.alert(
        'Erro',
        e instanceof ApiError
          ? e.message
          : 'Não foi possível gerar o PDF (é necessário estar conectado nesta etapa).',
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  if (erro) {
    return (
      <View style={styles.container}>
        <Text style={styles.erroTexto}>{erro}</Text>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.voltarTexto}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!manutencao) {
    return (
      <View style={styles.containerCarregando}>
        <ActivityIndicator size="large" color={cores.cyan} />
      </View>
    );
  }

  const fotosAntes = manutencao.fotos.filter((f) => f.tipo === 'ANTES');
  const fotosDepois = manutencao.fotos.filter((f) => f.tipo === 'DEPOIS');
  const fotosAntesPendentes = fotosPendentesLocais.filter((f) => f.tipo === 'ANTES');
  const fotosDepoisPendentes = fotosPendentesLocais.filter((f) => f.tipo === 'DEPOIS');
  const temAssinatura = !!manutencao.assinaturaUrl || !!assinaturaPendenteLocal;

  const podeAvancar =
    etapaAtual === 0
      ? manutencao.status !== 'AGENDADA'
      : etapaAtual === 2
        ? temAssinatura
        : true;

  function handleContinuar() {
    if (!podeAvancar) return;
    setEtapaAtual((atual) => Math.min(atual + 1, ETAPAS.length - 1));
  }

  function handleVoltarEtapa() {
    setEtapaAtual((atual) => Math.max(atual - 1, 0));
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltarPill} onPress={onVoltar}>
          <Text style={styles.voltarTextoHeader}>← Início</Text>
        </TouchableOpacity>
        <Text style={styles.headerOS}>{manutencao.numeroOS}</Text>
      </View>

      {exibindoDadosOffline && (
        <View style={styles.avisoOffline}>
          <Text style={styles.avisoOfflineTexto}>
            📡 Sem conexão - mostrando os últimos dados salvos no aparelho
          </Text>
        </View>
      )}

      <View style={styles.stepIndicador}>
        {ETAPAS.map((nome, index) => {
          const ativa = index === etapaAtual;
          const concluida = index < etapaAtual;
          return (
            <View key={nome} style={styles.stepItem}>
              <View
                style={[
                  styles.stepBolinha,
                  ativa && styles.stepBolinhaAtiva,
                  concluida && styles.stepBolinhaConcluida,
                ]}
              >
                {concluida ? (
                  <IconCheckCircle size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumero, ativa && styles.stepNumeroAtivo]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, ativa && styles.stepLabelAtivo]}>{nome}</Text>
              {index < ETAPAS.length - 1 && <View style={styles.stepLinha} />}
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.conteudo}>
        {etapaAtual === 0 && (
          <>
            <Text style={styles.condominioNome}>{manutencao.condominio.nome}</Text>
            <Text style={styles.condominioEndereco}>{manutencao.condominio.endereco}</Text>
            <Text style={styles.statusTexto}>Status: {manutencao.status}</Text>

            {manutencao.status === 'AGENDADA' ? (
              <TouchableOpacity
                style={styles.botaoPrincipal}
                onPress={handleCheckin}
                disabled={fazendoCheckin}
              >
                <Text style={styles.botaoPrincipalTexto}>
                  {fazendoCheckin ? 'Obtendo localização...' : '📍 Fazer check-in'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.checkinOkBox}>
                <IconCheckCircle size={16} color={cores.sucesso} />
                <Text style={styles.checkinOkTexto}>Check-in realizado</Text>
              </View>
            )}
          </>
        )}

        {etapaAtual === 1 && (
          <>
            <Text style={styles.secaoTitulo}>Checklist</Text>
            {manutencao.checklist.map((item) => (
              <View key={item.id} style={styles.checklistLinha}>
                <Text
                  style={
                    item.status === 'DEFEITO' ? styles.checklistIconeDefeito : styles.checklistIconeOk
                  }
                >
                  {item.status === 'OK' ? '✓' : item.status === 'DEFEITO' ? '✕' : '–'}
                </Text>
                <Text style={styles.checklistTexto}>{item.item}</Text>
                {item.id.startsWith('local-') && <Text style={styles.pendenteTag}>pendente</Text>}
              </View>
            ))}

            <View style={styles.checklistForm}>
              <View style={styles.sugestoesLinha}>
                {CHECKLIST_SUGESTOES.map((sugestao) => (
                  <TouchableOpacity
                    key={sugestao}
                    style={styles.sugestaoChip}
                    onPress={() => setItemTexto(sugestao)}
                  >
                    <Text style={styles.sugestaoChipTexto}>{sugestao}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Ex: DVR ligando normalmente"
                value={itemTexto}
                onChangeText={setItemTexto}
              />
              <View style={styles.statusBotoes}>
                {STATUS_OPCOES.map((opcao) => (
                  <TouchableOpacity
                    key={opcao}
                    onPress={() => setItemStatus(opcao)}
                    style={[styles.statusBotao, itemStatus === opcao && styles.statusBotaoAtivo]}
                  >
                    <Text
                      style={[
                        styles.statusBotaoTexto,
                        itemStatus === opcao && styles.statusBotaoTextoAtivo,
                      ]}
                    >
                      {opcao === 'NAO_APLICAVEL' ? 'N/A' : opcao}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.botaoSecundario}
                onPress={handleAdicionarChecklist}
                disabled={salvandoItem}
              >
                <Text style={styles.botaoSecundarioTexto}>
                  {salvandoItem ? 'Salvando...' : '+ Adicionar item'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.secaoTitulo}>Pedidos</Text>
            {manutencao.pecas.length > 0 && (
              <View style={styles.listaPecas}>
                {manutencao.pecas.map((peca) => (
                  <View key={peca.id} style={styles.pecaLinha}>
                    <Text style={styles.pecaTexto}>
                      {peca.quantidade}x {peca.nome}
                      {peca.motivoTroca ? ` — ${peca.motivoTroca}` : ''}
                      {peca.id.startsWith('local-') ? '  ·  pendente' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.checklistForm}>
              <View style={styles.sugestoesLinha}>
                {PECAS_SUGESTOES.map((sugestao) => (
                  <TouchableOpacity
                    key={sugestao}
                    style={styles.sugestaoChip}
                    onPress={() => setPecaNome(sugestao)}
                  >
                    <Text style={styles.sugestaoChipTexto}>{sugestao}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Nome do pedido/peça"
                value={pecaNome}
                onChangeText={setPecaNome}
              />
              <View style={styles.pecaLinhaForm}>
                <TextInput
                  style={[styles.input, styles.pecaQuantidadeInput]}
                  placeholder="Qtd"
                  value={pecaQuantidade}
                  onChangeText={setPecaQuantidade}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.pecaMotivoInput]}
                  placeholder="Motivo da troca (opcional)"
                  value={pecaMotivo}
                  onChangeText={setPecaMotivo}
                />
              </View>
              <TouchableOpacity
                style={styles.botaoSecundario}
                onPress={handleAdicionarPeca}
                disabled={salvandoPeca}
              >
                <Text style={styles.botaoSecundarioTexto}>
                  {salvandoPeca ? 'Salvando...' : '+ Adicionar pedido'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.secaoTitulo}>Fotos</Text>
            <View style={styles.fotosLinha}>
              <View style={styles.fotosGrupo}>
                <Text style={styles.fotosGrupoTitulo}>
                  Antes ({fotosAntes.length + fotosAntesPendentes.length})
                </Text>
                <View style={styles.fotosGrid}>
                  {fotosAntes.map((f) => (
                    <Image
                      key={f.id}
                      source={{ uri: f.arquivoUrl }}
                      style={styles.fotoThumb}
                      onError={(e) =>
                        console.warn('Falha ao carregar foto:', f.arquivoUrl, e.nativeEvent.error)
                      }
                    />
                  ))}
                  {fotosAntesPendentes.map((f) => (
                    <View key={f.id} style={styles.fotoThumbPendenteWrap}>
                      <Image source={{ uri: f.uriLocal }} style={styles.fotoThumb} />
                      <Text style={styles.fotoThumbPendenteTag}>pendente</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.botaoFoto}
                  onPress={() => handleAdicionarFoto('ANTES')}
                  disabled={enviandoFoto === 'ANTES'}
                >
                  <Text style={styles.botaoFotoTexto}>
                    {enviandoFoto === 'ANTES' ? 'Enviando...' : '📷 Antes'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fotosGrupo}>
                <Text style={styles.fotosGrupoTitulo}>
                  Depois ({fotosDepois.length + fotosDepoisPendentes.length})
                </Text>
                <View style={styles.fotosGrid}>
                  {fotosDepois.map((f) => (
                    <Image
                      key={f.id}
                      source={{ uri: f.arquivoUrl }}
                      style={styles.fotoThumb}
                      onError={(e) =>
                        console.warn('Falha ao carregar foto:', f.arquivoUrl, e.nativeEvent.error)
                      }
                    />
                  ))}
                  {fotosDepoisPendentes.map((f) => (
                    <View key={f.id} style={styles.fotoThumbPendenteWrap}>
                      <Image source={{ uri: f.uriLocal }} style={styles.fotoThumb} />
                      <Text style={styles.fotoThumbPendenteTag}>pendente</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.botaoFoto}
                  onPress={() => handleAdicionarFoto('DEPOIS')}
                  disabled={enviandoFoto === 'DEPOIS'}
                >
                  <Text style={styles.botaoFotoTexto}>
                    {enviandoFoto === 'DEPOIS' ? 'Enviando...' : '📷 Depois'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.secaoTitulo}>Observações</Text>
            <TextInput
              style={styles.observacoesInput}
              placeholder="Observações gerais sobre a visita..."
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={styles.botaoSecundario}
              onPress={handleSalvarObservacoes}
              disabled={salvandoObservacoes}
            >
              <Text style={styles.botaoSecundarioTexto}>
                {salvandoObservacoes ? 'Salvando...' : 'Salvar observações'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {etapaAtual === 2 && (
          <>
            <Text style={styles.secaoTitulo}>Assinatura</Text>
            <Text style={styles.assinaturaInstrucao}>
              Peça para o síndico ou zelador assinar confirmando a execução do serviço.
            </Text>
            {manutencao.assinaturaUrl ? (
              <View>
                <Image source={{ uri: manutencao.assinaturaUrl }} style={styles.assinaturaImg} />
                <Text style={styles.assinaturaOk}>✓ Assinatura coletada</Text>
                {manutencao.assinanteNome && (
                  <Text style={styles.assinanteNomeTexto}>Responsável: {manutencao.assinanteNome}</Text>
                )}
              </View>
            ) : assinaturaPendenteLocal ? (
              <View>
                <Image
                  source={{ uri: `data:image/png;base64,${assinaturaPendenteLocal.base64}` }}
                  style={styles.assinaturaImg}
                />
                <Text style={styles.assinaturaOk}>✓ Assinatura coletada (pendente de envio)</Text>
                <Text style={styles.assinanteNomeTexto}>
                  Responsável: {assinaturaPendenteLocal.nomeAssinante}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Nome de quem vai assinar</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: João da Silva (síndico)"
                  value={assinanteNome}
                  onChangeText={setAssinanteNome}
                />
                <TouchableOpacity
                  style={[
                    styles.botaoSecundario,
                    !assinanteNome.trim() && styles.botaoSecundarioDesabilitado,
                  ]}
                  onPress={() => setMostrarAssinatura(true)}
                  disabled={!assinanteNome.trim()}
                >
                  <Text style={styles.botaoSecundarioTexto}>✍️ Coletar assinatura</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {etapaAtual === 3 && (
          <>
            <Text style={styles.secaoTitulo}>Resumo</Text>
            <View style={styles.resumoCard}>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Checklist</Text>
                <Text style={styles.resumoValor}>{manutencao.checklist.length} item(ns)</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Pedidos</Text>
                <Text style={styles.resumoValor}>{manutencao.pecas.length} registrado(s)</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Fotos</Text>
                <Text style={styles.resumoValor}>
                  {manutencao.fotos.length + fotosPendentesLocais.length} anexada(s)
                </Text>
              </View>
              <View style={[styles.resumoLinha, styles.resumoLinhaSemBorda]}>
                <Text style={styles.resumoLabel}>Assinatura</Text>
                <Text style={styles.resumoValor}>{temAssinatura ? '✓ Coletada' : 'Pendente'}</Text>
              </View>
            </View>

            {(fotosPendentesLocais.length > 0 || assinaturaPendenteLocal) && (
              <View style={styles.avisoPendenciasBox}>
                <Text style={styles.avisoPendenciasTexto}>
                  Existem itens ainda não enviados ao servidor (foto e/ou assinatura). O PDF só pode
                  ser gerado depois que tudo estiver sincronizado - abra o Modal de Sincronização
                  assim que a conexão voltar.
                </Text>
              </View>
            )}

            <Text style={styles.secaoTitulo}>Ordem de Serviço</Text>
            {manutencao.pdfUrl ? (
              <View style={styles.pdfAcoes}>
                <TouchableOpacity
                  style={styles.botaoPdf}
                  onPress={() => Linking.openURL(manutencao.pdfUrl!)}
                >
                  <Text style={styles.botaoPdfTexto}>📄 Abrir PDF da OS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botaoWhatsapp}
                  onPress={handleCompartilharWhatsApp}
                  disabled={compartilhandoPdf}
                >
                  <Text style={styles.botaoWhatsappTexto}>
                    {compartilhandoPdf ? 'Preparando PDF...' : 'Compartilhar PDF'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botaoConcluir} onPress={onVoltar}>
                  <Text style={styles.botaoConcluirTexto}>Concluir e voltar ao Início</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.botaoPrincipal, !manutencao.assinaturaUrl && styles.botaoDesabilitado]}
                onPress={handleGerarPdf}
                disabled={!manutencao.assinaturaUrl || gerandoPdf}
              >
                <Text style={styles.botaoPrincipalTexto}>
                  {gerandoPdf ? 'Gerando...' : 'Gerar PDF e fechar OS'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {etapaAtual < 3 && (
        <View style={[styles.navegacaoEtapas, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.botaoVoltarEtapa, etapaAtual === 0 && styles.botaoOculto]}
            onPress={handleVoltarEtapa}
            disabled={etapaAtual === 0}
          >
            <Text style={styles.botaoVoltarEtapaTexto}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botaoContinuar, !podeAvancar && styles.botaoDesabilitado]}
            onPress={handleContinuar}
            disabled={!podeAvancar}
          >
            <Text style={styles.botaoContinuarTexto}>Continuar</Text>
            <IconChevronRight size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={mostrarAssinatura} animationType="slide">
        <View style={styles.assinaturaModal}>
          <View style={styles.assinaturaHeader}>
            <Text style={styles.assinaturaHeaderTitulo}>Assinatura</Text>
            <TouchableOpacity onPress={() => setMostrarAssinatura(false)}>
              <Text style={styles.botaoFecharModalTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          <SignatureScreen
            ref={assinaturaRef}
            onOK={handleSalvarAssinatura}
            onEmpty={() => Alert.alert('Atenção', 'Desenhe a assinatura antes de salvar.')}
            descriptionText="Assine no quadro abaixo"
            webStyle={ASSINATURA_WEBSTYLE}
            style={styles.assinaturaCanvas}
          />
          <View style={[styles.assinaturaAcoes, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={styles.botaoLimparAssinatura}
              onPress={() => assinaturaRef.current?.clearSignature()}
            >
              <Text style={styles.botaoLimparAssinaturaTexto}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.botaoSalvarAssinatura}
              onPress={() => assinaturaRef.current?.readSignature()}
            >
              <Text style={styles.botaoSalvarAssinaturaTexto}>Salvar assinatura</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  containerCarregando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: cores.fundo,
  },
  header: {
    backgroundColor: cores.navy,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botaoVoltarPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  voltarTextoHeader: { color: cores.textoOnDarkMuted, fontSize: 13 },
  headerOS: { color: '#fff', fontWeight: '700', fontSize: 14 },
  voltarTexto: { color: cores.cyan, marginTop: 12, fontSize: 14 },

  avisoOffline: {
    backgroundColor: cores.avisoFundo,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avisoOfflineTexto: { fontSize: 12, color: cores.aviso, fontWeight: '600', textAlign: 'center' },

  stepIndicador: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepBolinha: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cores.fundo,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBolinhaAtiva: { backgroundColor: cores.cyan, borderColor: cores.cyan },
  stepBolinhaConcluida: { backgroundColor: cores.sucesso, borderColor: cores.sucesso },
  stepNumero: { fontSize: 11, fontWeight: '700', color: cores.textoMuted },
  stepNumeroAtivo: { color: '#fff' },
  stepLabel: { fontSize: 10, color: cores.textoMuted, marginTop: 4, fontWeight: '600' },
  stepLabelAtivo: { color: cores.textoTitulo },
  stepLinha: {
    position: 'absolute',
    top: 12,
    left: '62%',
    right: '-38%',
    height: 1.5,
    backgroundColor: cores.borda,
  },

  conteudo: { padding: 20, paddingBottom: 32 },
  condominioNome: { fontSize: 18, fontWeight: '700', color: cores.textoTitulo },
  condominioEndereco: { fontSize: 13, color: cores.textoMuted, marginTop: 2 },
  statusTexto: { fontSize: 13, color: cores.textoMuted, marginTop: 6, marginBottom: 16 },
  erroTexto: { color: cores.perigo, fontSize: 14, margin: 20 },
  secaoTitulo: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 10, color: cores.textoTitulo },
  checkinOkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: cores.sucessoFundo,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  checkinOkTexto: { color: cores.sucesso, fontWeight: '700', fontSize: 13.5 },
  botaoPrincipal: {
    backgroundColor: cores.cyan,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoPrincipalTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  botaoDesabilitado: { backgroundColor: cores.borda },
  checklistLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  checklistIconeOk: { color: cores.sucesso, fontWeight: '700' },
  checklistIconeDefeito: { color: cores.perigo, fontWeight: '700' },
  checklistTexto: { fontSize: 14, color: cores.textoTitulo, flex: 1 },
  pendenteTag: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.aviso,
    backgroundColor: cores.avisoFundo,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  checklistForm: { marginTop: 10, gap: 8 },
  sugestoesLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  sugestaoChip: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  sugestaoChipTexto: { fontSize: 11, color: cores.textoMuted },
  input: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  statusBotoes: { flexDirection: 'row', gap: 8 },
  statusBotao: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  statusBotaoAtivo: { backgroundColor: cores.cyanClaro, borderColor: cores.cyan },
  statusBotaoTexto: { fontSize: 12, color: cores.textoMuted },
  statusBotaoTextoAtivo: { color: cores.cyanForte, fontWeight: '700' },
  botaoSecundario: {
    borderWidth: 1,
    borderColor: cores.cyan,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  botaoSecundarioTexto: { color: cores.cyanForte, fontWeight: '700', fontSize: 13 },
  botaoSecundarioDesabilitado: { borderColor: cores.borda, opacity: 0.6 },
  fotosLinha: { flexDirection: 'row', gap: 12 },
  fotosGrupo: { flex: 1 },
  fotosGrupoTitulo: { fontSize: 12, fontWeight: '600', color: cores.textoMuted, marginBottom: 6 },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fotoThumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: cores.borda },
  fotoThumbPendenteWrap: { position: 'relative' },
  fotoThumbPendenteTag: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    fontSize: 7.5,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(146,64,14,0.85)',
    textAlign: 'center',
    borderRadius: 3,
    paddingVertical: 1,
  },
  botaoFoto: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  botaoFotoTexto: { fontSize: 12, color: cores.textoTitulo },
  listaPecas: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  pecaLinha: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  pecaTexto: { fontSize: 13.5, color: cores.textoTitulo },
  pecaLinhaForm: { flexDirection: 'row', gap: 8 },
  pecaQuantidadeInput: { width: 70 },
  pecaMotivoInput: { flex: 1 },
  observacoesInput: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  assinaturaInstrucao: { fontSize: 13, color: cores.textoMuted, marginBottom: 14, lineHeight: 18 },
  label: { fontSize: 12.5, fontWeight: '600', color: cores.textoMuted, marginBottom: 6 },
  assinanteNomeTexto: { fontSize: 12.5, color: cores.textoMuted, marginTop: 4 },
  avisoPendenciasBox: {
    backgroundColor: cores.avisoFundo,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  avisoPendenciasTexto: { fontSize: 12, color: cores.aviso, lineHeight: 17 },
  pdfAcoes: { gap: 10 },
  botaoWhatsapp: {
    backgroundColor: cores.whatsapp,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoWhatsappTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  botaoConcluir: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoConcluirTexto: { color: cores.textoMuted, fontWeight: '700', fontSize: 14 },
  assinaturaImg: {
    width: 200,
    height: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
  },
  assinaturaOk: { color: cores.sucesso, fontWeight: '700', fontSize: 13, marginTop: 6 },
  assinaturaModal: { flex: 1, backgroundColor: '#fff' },
  assinaturaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  assinaturaHeaderTitulo: { fontSize: 16, fontWeight: '700', color: cores.textoTitulo },
  assinaturaCanvas: { flex: 1 },
  assinaturaAcoes: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  botaoLimparAssinatura: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoLimparAssinaturaTexto: { color: cores.textoMuted, fontWeight: '600', fontSize: 14 },
  botaoSalvarAssinatura: {
    flex: 2,
    backgroundColor: cores.cyan,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoSalvarAssinaturaTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  botaoFecharModalTexto: { color: cores.textoMuted, fontSize: 14, fontWeight: '600' },
  botaoPdf: {
    backgroundColor: cores.cyanClaro,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoPdfTexto: { color: cores.cyanForte, fontWeight: '700', fontSize: 14 },

  resumoCard: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  resumoLinhaSemBorda: { borderBottomWidth: 0 },
  resumoLabel: { fontSize: 13, color: cores.textoMuted },
  resumoValor: { fontSize: 13, fontWeight: '700', color: cores.textoTitulo },

  navegacaoEtapas: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  botaoVoltarEtapa: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoOculto: { opacity: 0 },
  botaoVoltarEtapaTexto: { color: cores.textoMuted, fontWeight: '700', fontSize: 14 },
  botaoContinuar: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: cores.cyan,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoContinuarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
