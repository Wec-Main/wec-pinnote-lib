import { isValidElement, type ReactNode } from 'react';
import type { BuiltInIcon } from '../models/NodeTypes';

const paths = {
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  cog: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  branch: 'M12 3l9 9-9 9-9-9z',
  input: 'M12 3v11 M7.5 9.5L12 14l4.5-4.5 M4 16v4h16v-4',
  output: 'M12 14V3 M7.5 7.5L12 3l4.5 4.5 M4 16v4h16v-4',
  puzzle: 'M4 8h4.5a2 2 0 1 1 4 0H17v4.5a2 2 0 1 1 0 4V20H4z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  mail: 'M3.5 6h17v12h-17z M4 6.5l8 6.5 8-6.5',
  database: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6 M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3.5 2',
  subprocess: 'M3.5 6h17v12h-17z M7 6v12 M17 6v12',
  undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  fit: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
  check: 'M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z M8.5 12l2.5 2.5 4.5-5',
  download: 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M5 20h14',
  upload: 'M12 16V5 M7.5 9.5L12 5l4.5 4.5 M5 20h14',
  lock: 'M6 11h12v9H6z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  unlock: 'M6 11h12v9H6z M8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  file: 'M14 3H6v18h12V7z M14 3v4h4 M12 11v6 M9 14h6',
  hand: 'M8 12.5V6a1.5 1.5 0 0 1 3 0v5 M11 5a1.5 1.5 0 0 1 3 0v6 M14 6.5a1.5 1.5 0 0 1 3 0V12 M17 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.8-2.4l-3-4.1a1.5 1.5 0 0 1 2.4-1.8L8 14.5',
  select: 'M4 4h3 M10 4h4 M17 4h3v3 M20 10v4 M4 10v4 M4 17v3h3 M4 7V4 M10 20h4 M20 17v3h-3',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M15.5 15.5L20 20',
  x: 'M6 6l12 12 M18 6L6 18',
  alert: 'M12 3.5L2.5 20h19z M12 10v4.5 M12 17.2v.3',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5.5 M12 7.8v.3',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  grid: 'M4 4h16v16H4z M4 9.3h16 M4 14.7h16 M9.3 4v16 M14.7 4v16',
  flow: 'M4 4h6v5H4z M14 15h6v5h-6z M7 9v3.5h10V15',
  success: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.2l2.8 2.8 5.2-5.5',
  curve: 'M4 19C4 9 20 15 20 5',
  chevron: 'M9 6l6 6-6 6',
  cut: 'M6 7a2.5 2.5 0 1 0 0 .1z M6 17a2.5 2.5 0 1 0 0 .1z M8 8.5L20 18 M8 15.5L20 6',
  paste: 'M9 4h6v3H9z M8 5.5H5.5V21h13V5.5H16',
  map: 'M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z M9 4v13.5 M15 6.5V20',
  alignLeft: 'M4 3v18 M8 7h11v4H8z M8 14h7v4H8z',
  alignCenter: 'M12 3v18 M6 7h12v4H6z M8.5 14h7v4h-7z',
  alignRight: 'M20 3v18 M5 7h11v4H5z M9 14h7v4H9z',
  alignTop: 'M3 4h18 M7 8v11h4V8z M14 8v7h4V8z',
  alignMiddle: 'M3 12h18 M7 6v12h4V6z M14 8.5v7h4v-7z',
  alignBottom: 'M3 20h18 M7 5v11h4V5z M14 9v7h4V9z',
  distributeH: 'M4 3v18 M20 3v18 M9.5 8h5v8h-5z',
  distributeV: 'M3 4h18 M3 20h18 M8 9.5h8v5H8z',
  save: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6',
  publish: 'M12 15V4 M7.5 8.5L12 4l4.5 4.5 M5 14v6h14v-6',
  circleShape: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  squareShape: 'M4 4h16v16H4z',
  rectangleShape: 'M3 6h18v12H3z',
  roundedRectShape: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  textShape: 'M5 5h14 M12 5v14',
  ellipseShape: 'M12 5c5 0 9 3.1 9 7s-4 7-9 7-9-3.1-9-7 4-7 9-7z',
  triangleShape: 'M12 4l9 16H3z',
  hexagonShape: 'M7 4h10l4 8-4 8H7l-4-8z',
  cylinderShape: 'M4 6c0-1.1 3.6-2 8-2s8 .9 8 2v12c0 1.1-3.6 2-8 2s-8-.9-8-2z M4 6c0 1.1 3.6 2 8 2s8-.9 8-2',
  cloudShape: 'M7 18a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-2A4.5 4.5 0 0 1 17 18z',
} as const;

export type IconName = keyof typeof paths;

const filled = new Set<IconName>([
  'play',
  'stop',
  'circleShape',
  'squareShape',
  'rectangleShape',
  'roundedRectShape',
  'ellipseShape',
  'triangleShape',
  'hexagonShape',
  'cylinderShape',
  'cloudShape',
]);

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled.has(name) ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled.has(name) ? 1.5 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Renders a node type icon: either a built-in icon name or any React node. */
export function NodeIcon({ icon, size = 16 }: { icon: BuiltInIcon | ReactNode; size?: number }) {
  if (typeof icon === 'string' && icon in paths) return <Icon name={icon as IconName} size={size} />;
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') return <>{icon}</>;
  return <Icon name="puzzle" size={size} />;
}
