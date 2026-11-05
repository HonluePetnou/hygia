/** Ressource FHIR telle que stockée : clé (type, id), patient concerné, version, contenu JSON. */
export interface StoredResource {
  resourceType: string;
  id: string;
  /** Patient concerné (`null` pour les ressources partagées : établissements, praticiens…). */
  patientId: string | null;
  version: number;
  body: unknown;
}

/** Stockage durable des ressources de Dossiers (PostgreSQL via Prisma ; faux en mémoire dans les tests). */
export interface ResourceStore {
  loadAll(): Promise<StoredResource[]>;
  /** Insère ou remplace les ressources données (clé : type + id). */
  upsert(rows: readonly StoredResource[]): Promise<void>;
}
