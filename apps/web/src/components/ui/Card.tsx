import type { HTMLAttributes } from 'react';

/** Surface blanche à bordure et ombre légère. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest} />;
}
