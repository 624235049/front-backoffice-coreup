import { type ReactNode, useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** Label + control + hint/error line. Error text is already translated by the caller. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Switch with a clickable label (and optional hint) wired together by id. */
export function SwitchRow({
  checked,
  onCheckedChange,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3 text-sm', className)}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="grid cursor-pointer gap-0.5 font-normal">
        <span>{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </Label>
    </div>
  );
}
