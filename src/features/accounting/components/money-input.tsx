import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { parseBahtToMinor } from '../lib/money';

const format = (minor: number | null) =>
  minor === null
    ? ''
    : (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Baht text box that reports integer satang (AGENTS rule 7). It keeps the text the person typed while
 * focused and re-formats to "1,250.00" on blur; invalid text reports `null`.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** Satang; null = empty. */
  value: number | null;
  onChange: (minor: number | null) => void;
}) {
  const [text, setText] = useState(format(value));
  const [focused, setFocused] = useState(false);

  // External changes (loading a document, switching VAT mode…) refresh the text unless the user is typing.
  useEffect(() => {
    if (!focused) setText(format(value));
  }, [value, focused]);

  return (
    <Input
      {...props}
      inputMode="decimal"
      className={cn('text-right tabular-nums', className)}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() === '' ? null : parseBahtToMinor(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        const minor = text.trim() === '' ? null : parseBahtToMinor(text);
        setText(format(minor));
      }}
    />
  );
}
