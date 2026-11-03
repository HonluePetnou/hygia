export interface AvatarProps {
  /** Nom complet dont on tire les initiales. */
  name: string;
}

/** Initiales (deux au plus) d'un nom. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Pastille d'initiales ; décorative, le nom est affiché à côté. */
export function Avatar({ name }: AvatarProps) {
  return (
    <span className="avatar" aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
