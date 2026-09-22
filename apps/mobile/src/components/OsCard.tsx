import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { cores } from '../theme/colors';
import { IconChevronRight, IconAlertTriangle } from '../theme/icons';

export interface OsCardData {
  id: string;
  numeroOS: string;
  status: string;
  prioridade: string;
  inicio: string | null;
  chamadoAvulso: boolean;
  observacao?: string | null;
  condominio: { nome: string; bairro?: string };
  // Nulo quando a OS foi gerada automaticamente pelo sistema e ainda não
  // teve técnico atribuído. Um TECNICO nunca recebe essas (o servidor já
  // filtra pela própria identidade), mas ADMIN/GESTOR veem a lista
  // completa, incluindo essas.
  tecnico: { id: string; nome: string } | null;
}

// Chamado avulso (criado pelo app com inicio = "agora") ganha essa
// tolerância antes de virar "atrasada" - sem isso, virava atrasado
// segundos depois de criado, já que "agora" sempre já é passado no
// instante seguinte. Visita agendada de verdade (painel web, com data
// escolhida) não tem essa tolerância - já é atrasada assim que a data
// marcada passa sem check-in.
const HORAS_TOLERANCIA_CHAMADO_AVULSO = 48;

export function estaAtrasada(
  item: Pick<OsCardData, 'status' | 'inicio' | 'chamadoAvulso'>,
): boolean {
  if (item.status !== 'AGENDADA' || !item.inicio) return false;
  const inicioMs = new Date(item.inicio).getTime();
  if (item.chamadoAvulso) {
    const limiteMs = Date.now() - HORAS_TOLERANCIA_CHAMADO_AVULSO * 60 * 60 * 1000;
    return inicioMs < limiteMs;
  }
  return inicioMs < Date.now();
}

const STATUS_INFO: Record<string, { label: string; cor: string; fundo: string }> = {
  AGENDADA: { label: 'Aberta', cor: cores.info, fundo: cores.infoFundo },
  EM_ANDAMENTO: { label: 'Em andamento', cor: cores.aviso, fundo: cores.avisoFundo },
  CONCLUIDA: { label: 'Concluída', cor: cores.sucesso, fundo: cores.sucessoFundo },
  CANCELADA: { label: 'Cancelada', cor: cores.textoMuted, fundo: cores.fundo },
  PENDENTE_SINCRONIZACAO: { label: 'Pendente sync.', cor: cores.perigo, fundo: cores.perigoFundo },
};

const CORES_PRIORIDADE: Record<string, string> = {
  ALTA: cores.perigo,
  MEDIA: cores.aviso,
};

function formatarAtraso(inicio: string): string {
  const diffMs = Date.now() - new Date(inicio).getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (dias >= 1) return `há ${dias} dia${dias > 1 ? 's' : ''}`;
  const horas = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  return `há ${horas}h`;
}

export function OsCard({ item, onPress }: { item: OsCardData; onPress: () => void }) {
  const statusInfo = STATUS_INFO[item.status] ?? STATUS_INFO.AGENDADA;
  const corPrioridade = CORES_PRIORIDADE[item.prioridade];
  const atrasada = estaAtrasada(item);
  const concluida = item.status === 'CONCLUIDA';
  const inicial = item.tecnico ? item.tecnico.nome.charAt(0).toUpperCase() : '?';

  return (
    <TouchableOpacity
      style={[styles.card, concluida && styles.cardConcluida]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.barraLateral, { backgroundColor: statusInfo.cor }]} />

      <View style={styles.conteudo}>
        <View style={styles.linhaTopo}>
          <View style={styles.linhaTopoEsquerda}>
            <Text style={styles.numeroOs}>{item.numeroOS}</Text>
            {corPrioridade && <View style={[styles.pontoPrioridade, { backgroundColor: corPrioridade }]} />}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusInfo.fundo }]}>
            <View style={[styles.statusPillPonto, { backgroundColor: statusInfo.cor }]} />
            <Text style={[styles.statusPillTexto, { color: statusInfo.cor }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.condominioNome}>{item.condominio.nome}</Text>
        {item.condominio.bairro && <Text style={styles.condominioBairro}>{item.condominio.bairro}</Text>}

        <View style={styles.linhaInferior}>
          <View style={[styles.avatarTecnico, { backgroundColor: statusInfo.fundo }]}>
            <Text style={[styles.avatarTecnicoTexto, { color: statusInfo.cor }]}>{inicial}</Text>
          </View>
          <Text style={styles.detalheTexto} numberOfLines={1}>
            {item.tecnico ? (
              item.tecnico.nome
            ) : (
              <Text style={styles.semTecnicoTexto}>Sem técnico atribuído</Text>
            )}
            {item.inicio ? ` · ${new Date(item.inicio).toLocaleString('pt-BR')}` : ''}
          </Text>
          <IconChevronRight size={15} color={cores.textoMuted} />
        </View>
      </View>

      {atrasada && item.inicio && (
        <View style={styles.faixaAtraso}>
          <IconAlertTriangle size={13} color={cores.perigo} />
          <Text style={styles.faixaAtrasoTexto}>Atrasada · venceu {formatarAtraso(item.inicio)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    marginBottom: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardConcluida: { opacity: 0.86 },
  barraLateral: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  conteudo: { padding: 14, paddingLeft: 20 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linhaTopoEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numeroOs: { fontSize: 12, fontWeight: '700', color: cores.textoMuted },
  pontoPrioridade: { width: 6, height: 6, borderRadius: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillPonto: { width: 5, height: 5, borderRadius: 2.5 },
  statusPillTexto: { fontSize: 11, fontWeight: '700' },
  condominioNome: { fontSize: 16, fontWeight: '700', color: cores.textoTitulo, marginTop: 8 },
  condominioBairro: { fontSize: 12, color: cores.textoMuted, marginTop: 1 },
  linhaInferior: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatarTecnico: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTecnicoTexto: { fontSize: 9.5, fontWeight: '800' },
  detalheTexto: { fontSize: 12, color: cores.textoMuted, flex: 1 },
  semTecnicoTexto: { color: cores.aviso, fontWeight: '700' },
  faixaAtraso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: cores.perigoFundo,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  faixaAtrasoTexto: { fontSize: 11.5, fontWeight: '700', color: cores.perigo },
});
