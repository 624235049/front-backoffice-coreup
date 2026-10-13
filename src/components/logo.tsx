export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="CoreUp">
      <rect width="64" height="64" rx="14" fill="#0B2D4F" />
      <path
        d="M18 14v22a14 14 0 0 0 28 0V14"
        fill="none"
        stroke="#F8F5ED"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M26 30l6-8 6 8M32 22v14"
        fill="none"
        stroke="#D4B483"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
