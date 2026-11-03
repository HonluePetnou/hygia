/** Type de ressource versionnée. */
export type VersionedType = 'Patient' | 'DocumentReference';

/** Version immuable d'une ressource du dossier (RF5). */
export interface ResourceVersion {
  /** UUID de la ressource. */
  resourceId: string;
  resourceType: VersionedType;
  /** Patient auquel la ressource appartient (pour l'historique du dossier). */
  patientId: string;
  /** Numéro de version de la ressource (identique au champ `version` de son contenu). */
  number: number;
  /** Identifiant de l'auteur de la modification (`système` pour l'état initial). */
  author: string;
  /** Date ISO de la modification. */
  createdAt: string;
  /** Motif de la modification. */
  reason: string;
  /** Contenu complet de la ressource à cette version. */
  content: Readonly<Record<string, unknown>>;
}

/** Données d'une nouvelle version, avant enregistrement. */
export type NewResourceVersion = Omit<ResourceVersion, 'content'> & {
  content: Record<string, unknown>;
};
