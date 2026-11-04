import { en } from './en.js';
import { fr, type MessageKey } from './fr.js';

/** Langues prises en charge. */
export type Locale = 'fr' | 'en';

/** Paramètres d'interpolation : `{nom}` est remplacé par `params.nom`. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/** Fonction de traduction. Une clé inconnue est renvoyée telle quelle. */
export type Translate = (key: MessageKey | (string & {}), params?: TranslationParams) => string;

const dictionaries: Record<Locale, Readonly<Record<string, string>>> = { fr, en };

/** Singulier ? En français 0 et 1 le sont (« 0 passage retrouvé ») ; en anglais, 1 seulement. */
const isSingular: Record<Locale, (n: number) => boolean> = {
  fr: (n) => Math.abs(n) < 2,
  en: (n) => n === 1,
};

/**
 * Crée la fonction `t` pour une langue.
 * `{nom}` est remplacé par `params.nom` ; `{nom:singulier|pluriel}` choisit la forme selon la
 * valeur numérique de `params.nom`. Un paramètre absent laisse le marqueur intact.
 */
export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, params) => {
    const template = Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(
      /\{(\w+)(?::([^|{}]*)\|([^{}]*))?\}/g,
      (marker, name: string, singular?: string, plural?: string) => {
        if (!Object.hasOwn(params, name)) return marker;
        const value = params[name] as string | number;
        if (singular === undefined || plural === undefined) return String(value);
        return isSingular[locale](Number(value)) ? singular : plural;
      },
    );
  };
}
