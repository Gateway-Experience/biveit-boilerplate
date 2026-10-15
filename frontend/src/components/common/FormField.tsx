import { useId } from 'react';

import { Input } from 'src/components/shadui/input';
import { Label } from 'src/components/shadui/label';
import { Textarea } from 'src/components/shadui/textarea';
import { cn } from 'cn';

type FieldShellProps = {
  label?: React.ReactNode;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean }) => React.ReactNode;
};

// MUI's TextField bundled label + helper text + error state into one component; shadcn splits
// them. This keeps the old prop shape (`label`, `error`, `helperText`) so call sites don't change.
export function FieldShell({
  label, error, helperText, fullWidth, className, id, children,
}: FieldShellProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      {children({ id: fieldId, 'aria-invalid': error || undefined })}
      {helperText && (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {helperText}
        </p>
      )}
    </div>
  );
}

type FormFieldProps = Omit<React.ComponentProps<'input'>, 'className'> & {
  label?: React.ReactNode;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  inputClassName?: string;
  // MUI's TextField grew a textarea via `multiline`; keep that spelling.
  multiline?: boolean;
  minRows?: number;
};

export default function FormField({
  label, error, helperText, fullWidth, className, inputClassName, multiline, minRows, ...inputProps
}: FormFieldProps) {
  return (
    <FieldShell
      label={label}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      className={className}
      id={inputProps.id}
    >
      {shellProps => (multiline
        ? (
          <Textarea
            {...(inputProps as React.ComponentProps<'textarea'>)}
            {...shellProps}
            rows={minRows}
            className={inputClassName}
          />
        )
        : <Input {...inputProps} {...shellProps} className={inputClassName} />
      )}
    </FieldShell>
  );
}
