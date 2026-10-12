import Svg, { Circle, Path, Rect } from 'react-native-svg';

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

/** Back (02). */
export function BackIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Not synced yet (07's "waiting for Wi-Fi" pill). */
export function CloudOffIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" stroke={color} {...stroke} />
      <Path d="M4 4l16 16" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Something needs attention (errors). */
export function AlertIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} {...stroke} />
      <Path d="M12 7.5v5M12 16h.01" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Last time / your past self (01), drawn in ice. */
export function GhostIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 20V11a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" stroke={color} {...stroke} />
      <Path d="M10 11h.01M14 11h.01" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Time / the bodyweight from that day (02). */
export function ClockIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} {...stroke} />
      <Path d="M12 7.5V12l3 2" stroke={color} {...stroke} />
    </Svg>
  );
}
