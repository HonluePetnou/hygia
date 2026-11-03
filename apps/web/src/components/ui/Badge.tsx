import type { HTMLAttributes } from 'react';

/** Tons du badge ; « ai » est réservé à ce qui vient de l'IA. */
export type BadgeTone = 'neutral' | 'danger' | 'warning' | 'success' | 'info' | 'ai';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Pastille d'état. */
export function Badge({ tone = 'neutral', className = '', ...rest }: BadgeProps) {
  return <span className={`badge badge-${tone} ${className}`.trim()} {...rest} />;
}
