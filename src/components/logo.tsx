const SOURCES = {
  /** square mark (the bar-chart "O") for tight spaces */
  mark: '/pwa-192.png',
  /** COREUP wordmark in brand navy + gold, for light backgrounds */
  wordmark: '/logo-wordmark.png',
  /** wordmark with light letters, for the navy sidebar */
  'wordmark-light': '/logo-wordmark-light.png',
  /** wordmark + "Business systems & consulting" tagline */
  full: '/logo-full.png',
} as const;

const DEFAULT_SIZE: Record<keyof typeof SOURCES, string> = {
  mark: 'size-8 rounded-lg',
  wordmark: 'h-10 w-auto',
  'wordmark-light': 'h-10 w-auto',
  full: 'h-28 w-auto',
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
