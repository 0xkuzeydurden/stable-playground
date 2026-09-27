import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: CardProps) {
  const classes = [
    'rounded-3xl border border-white/10 bg-surface/75 p-6 shadow-[0_35px_90px_rgba(9,44,30,0.45)] backdrop-blur-md backdrop-saturate-150',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={classes} {...props} />;
}

export default Card;
