import type { NewResourceVersion, ResourceVersion } from './resource-version.js';

/** Jeton d'injection de `DocumentStore`. */
export const DOCUMENT_STORE = Symbol('DOCUMENT_STORE');

/**
 * Stockage des versions : on n'y fait qu'ajouter, jamais remplacer (S3 versionné en production).
 */
export interface DocumentStore {
  /** Ajoute une version ; refuse (erreur) un numéro déjà enregistré pour cette ressource. */
  append(version: NewResourceVersion): Promise<ResourceVersion>;
  /** Versions d'une ressource, de la plus ancienne à la plus récente. */
  list(resourceId: string): Promise<ResourceVersion[]>;
  /** Une version précise, ou `undefined`. */
  get(resourceId: string, number: number): Promise<ResourceVersion | undefined>;
  /** Versions de toutes les ressources d'un patient, de la plus récente à la plus ancienne. */
  listForPatient(patientId: string): Promise<ResourceVersion[]>;
}

/** Ordre de l'historique du dossier : plus récent d'abord. */
export function newestFirst(a: ResourceVersion, b: ResourceVersion): number {
  return b.createdAt.localeCompare(a.createdAt) || b.number - a.number;
}
