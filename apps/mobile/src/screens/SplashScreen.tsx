import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cores } from '../theme/colors';
import { TexturaDiagonal } from '../components/TexturaDiagonal';

function Ponto({ atraso }: { atraso: number }) {
  const opacidade = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 600, delay: atraso, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0.55, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacidade, atraso]);

  return <Animated.View style={[styles.ponto, { opacity: opacidade }]} />;
}

export function SplashScreen() {
  return (
    <LinearGradient
      colors={[cores.navy, cores.cyan, cores.cyanForte]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={styles.container}
    >
      <TexturaDiagonal />
      <Image
        source={require('../../assets/techvigia-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.pontosLinha}>
        <Ponto atraso={0} />
        <Ponto atraso={200} />
        <Ponto atraso={400} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 230, height: 97, marginBottom: 32 },
  pontosLinha: { flexDirection: 'row', gap: 10 },
  ponto: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
});
