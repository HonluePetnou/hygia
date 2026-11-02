/**
 * Génère un UUID déterministe (forme v4 valide) à partir d'un préfixe de type et d'un rang.
 *
 * @param prefix Entier 0-255 identifiant la famille de ressources.
 * @param index Rang dans la famille.
 */
export function demoId(prefix: number, index: number): string {
  const head = prefix.toString(16).padStart(2, '0');
  const tail = index.toString(16).padStart(10, '0');
  return `00000000-0000-4000-8000-${head}${tail}`;
}

/** Préfixes des familles de ressources du jeu de démonstration. */
export const ID_PREFIX = {
  organization: 1,
  practitioner: 2,
  patient: 3,
  careTeam: 4,
  document: 5,
  observation: 6,
  condition: 7,
  medication: 8,
  allergy: 9,
  encounter: 10,
} as const;
