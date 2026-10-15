import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline: 'border border-input bg-white shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // docs/04 §9: touch targets >= 44px.
        default: 'h-11 px-4 py-2',
        sm: 'h-9 gap-1.5 px-3 text-sm max-md:h-11',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9 max-md:size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Why the action cannot run right now (already translated). When set the button looks disabled but stays
     * clickable, and a click shows the reason as a toast instead of doing nothing. Use `disabled` only while a
     * request is in flight; every other "can't do this yet" state MUST explain itself through this prop.
     */
    blockedReason?: string | false | null;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  blockedReason,
  onClick,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const blocked = typeof blockedReason === 'string' && blockedReason.length > 0;
  return (
    <Comp
      data-slot="button"
      data-blocked={blocked || undefined}
      aria-disabled={blocked || props['aria-disabled']}
      className={cn(buttonVariants({ variant, size, className }), blocked && 'cursor-not-allowed opacity-50')}
      onClick={
        blocked
          ? (e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              toast.warning(blockedReason, { id: `blocked:${blockedReason}` });
            }
          : onClick
      }
      {...props}
    />
  );
}

export { Button, buttonVariants };
