import type { ButtonHTMLAttributes } from 'react';

/** Variantes visuelles ; « ai » est réservé aux actions déclenchant l'IA. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Occupe toute la largeur du conteneur. */
  block?: boolean;
}

/** Bouton du design system. */
export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
