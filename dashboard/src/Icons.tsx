/** Inline SVG icons for actions. Default size 18px; use className or style to override. */

const iconSize = 18;

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
  title?: string;
}

export function IconStop({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function IconCode({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/** VS Code logo (ribbon/chevron mark). */
export function IconVscode({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path
        fill="currentColor"
        d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"
      />
    </svg>
  );
}

export function IconCopy({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconClose({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconCheck({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Git branch icon. */
export function IconBranch({ size = iconSize, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="6" cy="18" r="3" />
      <line x1="6" y1="9" x2="18" y2="6" />
      <circle cx="18" cy="6" r="3" />
    </svg>
  );
}
