import type { DocumentReference, Reference } from '@hygia/types';

/** Document brut soumis à la chaîne. */
export interface RawDocument {
  fileName: string;
  bytes: Uint8Array;
  /** Patient concerné (obligatoire pour produire un DocumentReference). */
  subject?: Reference;
  /** Canal d'arrivée (« WhatsApp », « Import »…), conservé tout au long de la chaîne. */
  channel?: string;
}

/** Types de médias acceptés. */
export type MediaType =
  'application/pdf' | 'image/png' | 'image/jpeg' | 'text/csv' | 'application/json';

/** Sortie du filtre Réception. */
export interface ReceivedDocument {
  /** Empreinte SHA-256 hexadécimale du contenu. */
  sha256: string;
  fileName: string;
  mediaType: MediaType;
  bytes: Uint8Array;
  subject?: Reference;
  channel?: string;
  /** Vrai si le contenu a déjà été reçu (traitement arrêté). */
  duplicate: boolean;
}

/** Sortie du filtre OCR. */
export interface OcrDocument extends ReceivedDocument {
  text: string;
}

/** Sortie du filtre Normalisation. */
export interface NormalizedDocument extends OcrDocument {
  reference: DocumentReference;
}

/** Entité extraite avec son code et sa confiance. */
export interface ExtractedEntity {
  kind: 'medication' | 'diagnosis' | 'posology' | 'date';
  /** Texte tel que trouvé dans le document. */
  text: string;
  /** Code ATC (médicament) ou CIM-10 (diagnostic). */
  code?: string;
  /** Confiance entre 0 et 1. */
  confidence: number;
}

/** Sortie du filtre Extraction. */
export interface ExtractedDocument extends NormalizedDocument {
  entities: ExtractedEntity[];
}

/** Identifiant direct repéré dans le texte. */
export interface DetectedIdentifier {
  kind: 'name' | 'phone' | 'date';
  value: string;
}

/** Sortie du filtre Détection des identifiants. */
export interface IdentifiedDocument extends ExtractedDocument {
  identifiers: DetectedIdentifier[];
}

/** Sortie de la branche clinique (6a). */
export interface IndexedDocument {
  documentId: string;
  passages: string[];
  entities: ExtractedEntity[];
}

/** Sortie de la branche analytique (6b) : aucune donnée directement identifiante. */
export interface PseudonymizedDocument {
  documentId: string;
  text: string;
  entities: ExtractedEntity[];
  tokens: string[];
}
