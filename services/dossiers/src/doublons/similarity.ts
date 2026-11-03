import type { Patient } from '@hygia/types';

/** Poids de chaque critère dans le score (somme = 1). */
export const WEIGHTS = { name: 0.45, birthDate: 0.3, phone: 0.15, gender: 0.1 } as const;

/** Critère du score. */
export type Criterion = keyof typeof WEIGHTS;

/** Détail du score : similarité de chaque critère (0 à 1), `null` si une des valeurs manque. */
export type CriteriaScores = Record<Criterion, number | null>;

/** Résultat de la comparaison de deux patients. */
export interface Similarity {
  /** Score global entre 0 et 1. */
  score: number;
  criteria: CriteriaScores;
}

/** Minuscules, sans accents, ponctuation ni espaces multiples. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Distance de Levenshtein. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(
        Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = row;
  }
  return previous[b.length] ?? 0;
}

/** Ressemblance de deux chaînes : 1 - distance / longueur maximale. */
function ratio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance(a, b) / longest;
}

/** Nom complet normalisé, mots triés : « NGO BASSA Florence » = « Florence Bassa-Ngo ». */
function sortedName(patient: Patient): string {
  return normalizeText(`${patient.givenName} ${patient.familyName}`).split(' ').sort().join(' ');
}

/** Chiffres du téléphone sans l'indicatif pays (9 derniers chiffres). */
function digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

function birthScore(a: string, b: string): number {
  if (a === b) return 1;
  const [ya, ma, da] = a.split('-');
  const [yb, mb, db] = b.split('-');
  // Jour et mois inversés, ou une seule composante différente : saisie probablement erronée.
  if (ya === yb && ma === db && da === mb) return 0.6;
  const same = Number(ya === yb) + Number(ma === mb) + Number(da === db);
  return same === 2 ? 0.5 : 0;
}

/**
 * Score de similarité entre deux fiches (RF4).
 *
 * - `name` (0,45) : nom + prénom normalisés (accents, casse, ponctuation), mots triés pour ignorer
 *   l'ordre, puis ressemblance de Levenshtein (1 = identiques).
 * - `birthDate` (0,30) : 1 si identique, 0,6 si jour et mois sont inversés, 0,5 si deux
 *   composantes sur trois concordent, sinon 0.
 * - `phone` (0,15) : ressemblance de Levenshtein sur les 9 derniers chiffres.
 * - `gender` (0,10) : 1 si identique, sinon 0 ; « inconnu » n'est pas comparé.
 *
 * Un critère dont une valeur manque est ignoré et les poids restants sont renormalisés.
 */
export function compare(a: Patient, b: Patient): Similarity {
  const criteria: CriteriaScores = {
    name: ratio(sortedName(a), sortedName(b)),
    birthDate: a.birthDate && b.birthDate ? birthScore(a.birthDate, b.birthDate) : null,
    phone: a.phone && b.phone ? ratio(digits(a.phone), digits(b.phone)) : null,
    gender: a.gender === 'unknown' || b.gender === 'unknown' ? null : Number(a.gender === b.gender),
  };
  let total = 0;
  let weights = 0;
  for (const key of Object.keys(WEIGHTS) as Criterion[]) {
    const value = criteria[key];
    if (value === null) continue;
    total += value * WEIGHTS[key];
    weights += WEIGHTS[key];
  }
  return { score: weights === 0 ? 0 : total / weights, criteria };
}
