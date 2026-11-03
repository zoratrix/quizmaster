import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cx('field', className)}>
      {label ? <span className="field__label">{label}</span> : null}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}
