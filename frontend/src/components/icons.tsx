import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

// Stroke icons from the designs: 24 × 24 viewBox, 1.8 stroke, round caps and joins.
const stroke = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function TodayIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" stroke={color} {...stroke} />
    </Svg>
  );
}

export function SplitsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 12a8 8 0 1 1-2.34-5.66" stroke={color} {...stroke} />
      <Path d="M20 4v4.5h-4.5" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ProgressIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 19h16" stroke={color} {...stroke} />
      <Path d="M6 15l4-5 3.5 3L19 6" stroke={color} {...stroke} />
    </Svg>
  );
}

export function HistoryIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={5} width={17} height={15} rx={2.5} stroke={color} {...stroke} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} {...stroke} />
    </Svg>
  );
}
