import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  calendar:
    'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z M3 9h18 M8 2v4 M16 2v4 M7 13h2 M12 13h2 M7 17h2',
  users:
    'M15 21v-2a6 6 0 0 0-12 0v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M17 3a4 4 0 0 1 0 8 M18 15a5 5 0 0 1 3 4v2',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  book: 'M12 5v16 M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Z',
  chart: 'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  check: 'm5 12 4 4L19 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
};
export function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.book} />
    </svg>
  );
}
