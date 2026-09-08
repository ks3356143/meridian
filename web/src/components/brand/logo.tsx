export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="5" ry="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="1" x2="16" y2="5" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="27" x2="16" y2="31" stroke="currentColor" strokeWidth="2" />
      <line x1="1" y1="16" x2="5" y2="16" stroke="currentColor" strokeWidth="2" />
      <line x1="27" y1="16" x2="31" y2="16" stroke="currentColor" strokeWidth="2" />
      <rect x="14.5" y="14.5" width="3" height="3" fill="currentColor" />
    </svg>
  );
}
