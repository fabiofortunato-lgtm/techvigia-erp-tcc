import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { cores } from '../theme/colors';

function Bloco({ largura, altura }: { largura: number | `${number}%`; altura: number }) {
  return <View style={[styles.bloco, { width: largura, height: altura }]} />;
}

function CardSkeleton() {
  const opacidade = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacidade]);

  return (
    <Animated.View style={[styles.card, { opacity: opacidade }]}>
      <View style={styles.linhaTopo}>
        <Bloco largura={70} altura={12} />
        <Bloco largura={80} altura={20} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Bloco largura="60%" altura={16} />
      </View>
      <View style={{ marginTop: 8 }}>
        <Bloco largura="40%" altura={12} />
      </View>
    </Animated.View>
  );
}

export function ListaSkeleton({ quantidade = 3 }: { quantidade?: number }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {Array.from({ length: quantidade }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 14,
    marginBottom: 10,
  },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  bloco: { backgroundColor: '#eceef1', borderRadius: 5 },
});
