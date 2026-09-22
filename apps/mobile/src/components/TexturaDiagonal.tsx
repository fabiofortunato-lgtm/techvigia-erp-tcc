import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';

/**
 * Reproduz o `repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0px,
 * rgba(255,255,255,.05) 1px, transparent 1px, transparent 11px)` do handoff
 * de design - um padrão de linhas diagonais finas e bem sutis, usado sobre
 * fundos com degradê (Splash, topo do Login, banners de Início/Perfil).
 *
 * Preenche 100% do espaço do elemento pai (posicionamento absoluto cabe a
 * quem usa o componente).
 */
export function TexturaDiagonal() {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <Pattern
          id="listras"
          patternUnits="userSpaceOnUse"
          width={11}
          height={11}
          patternTransform="rotate(45)"
        >
          <Line x1="0" y1="0" x2="0" y2="11" stroke="rgba(255,255,255,0.09)" strokeWidth={1.5} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#listras)" />
    </Svg>
  );
}
