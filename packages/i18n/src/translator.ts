import { en } from './en.js';
import { fr, type MessageKey } from './fr.js';

/** Langues prises en charge. */
export type Locale = 'fr' | 'en';

/** Paramètres d'interpolation : `{nom}` est remplacé par `params.nom`. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/** Fonction de traduction. Une clé inconnue est renvoyée telle quelle. */
export type Translate = (key: MessageKey | (string & {}), params?: TranslationParams) => string;

const dictionaries: Record<Locale, Readonly<Record<string, string>>> = { fr, en };

/**
 * Crée la fonction `t` pour une langue.
 * Un paramètre absent laisse le marqueur `{nom}` intact.
 */
export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, params) => {
    const template = Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (marker, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : marker,
    );
  };
}
