import type { Language } from '@hygia/types';

const FRENCH_WORDS = new Set(
  `le la les de du des un une est sont quel quelle quels quelles que qui quoi quand comment
   prend prennent elle il ils elles ce cette ces dans pour sur avec et ou au aux en par pas
   son sa ses ont été a-t-il y`.split(/\s+/),
);

const ENGLISH_WORDS = new Set(
  `the an is are was were what which who when how did does do of for with and or in on to has
   have had show shows this that these those her his she he it its by not been`.split(/\s+/),
);

/** Mots vides ignorés par la recherche (français et anglais). */
const STOP_WORDS = new Set([...FRENCH_WORDS, ...ENGLISH_WORDS, 'a', 'l', 'd', 'qu', 'n', 's']);

const strip = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Mots d'un texte, sans accents ni mots vides, avec pluriel simple retiré. */
export function tokenize(text: string): string[] {
  const words = strip(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .filter((word) => !STOP_WORDS.has(word) && word.length > 1)
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word));
}

/**
 * Détecte la langue d'une question (français ou anglais) par comptage de mots grammaticaux.
 * En cas d'égalité, ou sans indice, le français est retenu.
 */
export function detectLanguage(question: string): Language {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  let french = 0;
  let english = 0;
  for (const word of words) {
    if (FRENCH_WORDS.has(word)) french += 1;
    if (ENGLISH_WORDS.has(word)) english += 1;
  }
  return english > french ? 'en' : 'fr';
}
