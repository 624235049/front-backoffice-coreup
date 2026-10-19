const SOURCES = {
  /** square app icon (the teal "UP" arrow on a white tile) for tight spaces */
  mark: '/pwa-192-v2.png',
  /** COREUP wordmark (navy CORE + teal UP), for light backgrounds */
  wordmark: '/logo-wordmark-v2.png',
  /** wordmark with light letters, for the navy sidebar */
  'wordmark-light': '/logo-wordmark-light-v2.png',
} as const;

const DEFAULT_SIZE: Record<keyof typeof SOURCES, string> = {
  mark: 'size-8 rounded-lg',
  wordmark: 'h-12 w-auto',
  'wordmark-light': 'h-12 w-auto',
};

export function Logo({
  variant = 'mark',
  className,
}: {
  variant?: keyof typeof SOURCES;
  className?: string;
}) {
  return (
    <img
      src={SOURCES[variant]}
      alt="CoreUp"
      className={className ?? DEFAULT_SIZE[variant]}
      decoding="async"
    />
  );
}
