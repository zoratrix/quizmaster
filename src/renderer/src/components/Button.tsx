import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger' | 'ok' | 'mid' | 'bad';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', block, className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        className
      )}
      {...rest}
    />
  );
});
