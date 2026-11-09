import type * as React from 'react';
import { cn } from '@/lib/utils';
import { autofillProps } from './input';

function Textarea({ className, autoComplete, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      {...autofillProps(autoComplete)}
      className={cn(
        'flex min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
