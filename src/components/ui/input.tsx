import type * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
