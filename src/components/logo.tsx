const SOURCES = {
  /** emblem + COREUP + GROW TOGETHER side by side, dark lettering, for light backgrounds */
  lockup: '/logo-lockup-v7.png',
  /** same lockup with white lettering, for the navy sidebar and brand panels */
  'lockup-light': '/logo-lockup-onDark-v7.png',
  /** stacked emblem over COREUP + tagline with white lettering, for large dark brand panels */
  'full-light': '/logo-full-onDark-v7.png',
} as const;

/** intrinsic pixel size of each file, so the browser reserves the box before the image loads */
const SIZES = {
  lockup: { w: 905, h: 240 },
  'lockup-light': { w: 829, h: 240 },
  'full-light': { w: 574, h: 560 },
} as const;

/** the height is set, the width follows the file's own ratio (never stretched) */
const DEFAULT_SIZE: Record<keyof typeof SOURCES, string> = {
  lockup: 'h-12 w-auto',
  'lockup-light': 'h-14 w-auto',
  'full-light': 'h-44 w-auto',
};

export function Logo({
  variant = 'lockup',
  className,
}: {
  variant?: keyof typeof SOURCES;
  className?: string;
}) {
  return (
    <img
      src={SOURCES[variant]}
      width={SIZES[variant].w}
      height={SIZES[variant].h}
      alt="CoreUp"
      className={className ?? DEFAULT_SIZE[variant]}
      decoding="async"
    />
  );
}
