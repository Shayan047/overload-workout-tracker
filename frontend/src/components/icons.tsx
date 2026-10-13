import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number; strokeWidth?: number };

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

/** Opens something (03's preset cards). */
export function ChevronRightIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" stroke={color} {...stroke} />
    </Svg>
  );
}

export function PlusIcon({ color, size = 22, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" stroke={color} {...stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CheckIcon({ color, size = 22, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} {...stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CloseIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} {...stroke} />
    </Svg>
  );
}

export function SearchIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} {...stroke} />
      <Path d="M16 16l4.5 4.5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Rename (05). */
export function PencilIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20h4L19 9l-4-4L4 16z" stroke={color} {...stroke} />
      <Path d="M13.5 6.5l4 4" stroke={color} {...stroke} />
    </Svg>
  );
}

/** The six-dot drag handle (04, 05). */
export function DragHandleIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" stroke={color} {...stroke} strokeWidth={3} />
    </Svg>
  );
}

/** "More options" (05). */
export function MoreIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h.01M12 12h.01M19 12h.01" stroke={color} {...stroke} strokeWidth={3} />
    </Svg>
  );
}

/** Rest length (05's rest pill). */
export function TimerIcon({ color, size = 12 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={13} r={7.5} stroke={color} {...stroke} strokeWidth={2} />
      <Path d="M12 9.5V13l2 1.5M10 3h4" stroke={color} {...stroke} strokeWidth={2} />
    </Svg>
  );
}

/** Profile (07's header). */
export function PersonIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={3.5} stroke={color} {...stroke} />
      <Path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Start workout (07): a filled triangle. */
export function PlayIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5v15l12-7.5z" fill={color} />
    </Svg>
  );
}
