import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_12px_30px_rgba(23,148,102,0.18)]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[#27B87A] via-[#21A86E] to-[#2DCF87] text-[#041811] hover:from-[#1fa26b] hover:to-[#34d593]',
  secondary:
    'bg-white/10 text-text hover:bg-white/15 border border-white/10 shadow-[0_8px_24px_rgba(6,34,24,0.35)]',
  ghost: 'bg-transparent text-muted hover:bg-white/5 border border-white/5 shadow-none',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const classes = [base, variants[variant], className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}

export default Button;
