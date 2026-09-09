// Ícones simples em traço (inspirados em SF Symbols), sem depender de
// nenhuma biblioteca externa — só SVG inline, currentColor pra herdar a cor
// do texto ao redor.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export function IconResumo({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} {...base} fill={filled ? 'currentColor' : 'none'}>
      <rect x="4" y="11" width="4" height="8" rx="1.2" />
      <rect x="10" y="7" width="4" height="12" rx="1.2" />
      <rect x="16" y="3.5" width="4" height="15.5" rx="1.2" />
    </svg>
  );
}

export function IconPlusCircle({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} {...base} fill={filled ? 'currentColor' : 'none'}>
      <circle cx="12" cy="12" r="9" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 8v8M8 12h8" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    </svg>
  );
}

export function IconList({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <path d={filled ? 'M9 6h11M9 12h11M9 18h11' : 'M9 6h11M9 12h9M9 18h7'} />
    </svg>
  );
}

export function IconTag({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} {...base} fill={filled ? 'currentColor' : 'none'}>
      <path d="M11.2 3.5h-4a2 2 0 0 0-1.42.59L3.6 6.27a2 2 0 0 0-.59 1.42v4a2 2 0 0 0 .59 1.42l8.3 8.3a2 2 0 0 0 2.83 0l6.03-6.03a2 2 0 0 0 0-2.83l-8.3-8.3a2 2 0 0 0-1.26-.75Z" />
      <circle cx="8" cy="8" r="1.4" fill={filled ? 'var(--surface)' : 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconTrash({ size = 18 }) {
  return (
    <svg width={size} height={size} {...base} strokeWidth={1.6}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6 7l.8 12a2 2 0 0 0 2 1.9h6.4a2 2 0 0 0 2-1.9L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconChevron({ size = 16, open = false }) {
  return (
    <svg
      width={size}
      height={size}
      {...base}
      strokeWidth={2}
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconLock({ size = 40 }) {
  return (
    <svg width={size} height={size} {...base} strokeWidth={1.6}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRepeat({ size = 18 }) {
  return (
    <svg width={size} height={size} {...base} strokeWidth={1.7}>
      <path d="M4 12a8 8 0 0 1 14.5-4.5M20 12a8 8 0 0 1-14.5 4.5" />
      <path d="M18.5 3.5v4h-4M5.5 20.5v-4h4" />
    </svg>
  );
}
