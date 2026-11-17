import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PageChannel } from '../api';

/** lucide has no brand marks: the three channels are small round badges (LINE green, Facebook blue, Instagram gradient). */
const TONE: Record<PageChannel, string> = {
  line: 'bg-[#06C755]',
  messenger: 'bg-[#1877F2]',
  instagram: 'bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5]',
};

const GLYPH: Record<PageChannel, React.ReactNode> = {
  line: (
    <path d="M12 4C7.6 4 4 6.9 4 10.5c0 3.2 2.8 5.8 6.6 6.4.3.1.6.2.7.5l-.1.8c0 .3-.2 1 .9.5s5.8-3.4 7.9-5.8c1-1.1 1-2.3 1-2.4C21 6.9 16.9 4 12 4Z" />
  ),
  messenger: (
    <text x="12" y="18.5" textAnchor="middle" fontSize="17" fontWeight="700" fontFamily="Arial, sans-serif">
      f
    </text>
  ),
  instagram: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.2" cy="7.8" r="1" />
    </>
  ),
};

export function ChannelIcon({ channel, className }: { channel: PageChannel; className?: string }) {
  const { t } = useTranslation('pageInbox');
  const label = t(`channelFilter.${channel}`);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid={`channel-${channel}`}
      className={cn(
        'inline-grid size-[18px] shrink-0 place-items-center rounded-full text-white',
        TONE[channel],
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[13px]" fill="currentColor" aria-hidden>
        {GLYPH[channel]}
      </svg>
    </span>
  );
}
