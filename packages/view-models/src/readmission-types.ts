/** Niveau de risque renvoyé par le service Agents. */
export type ReadmissionLevel = 'faible' | 'modere' | 'eleve';

/** Facteurs anonymes envoyés au modèle (jamais de nom, d'identifiant ni de date de naissance). */
export interface ReadmissionFactors {
  age: number;
  hospitalisations: number;
  traitements: number;
  insuffisanceCardiaque: 0 | 1;
  diabete: 0 | 1;
}

/** Un facteur et sa contribution au score (log-odds ; positive = augmente le risque). */
export interface ReadmissionFactor {
  code: keyof ReadmissionFactors;
  libelle: string;
  contribution: number;
}

/** Estimation du risque de réadmission à 30 jours (aide à la décision). */
export interface ReadmissionEstimate {
  /** Probabilité entre 0 et 1. */
  score: number;
  niveau: ReadmissionLevel;
  /** Triés par poids décroissant. */
  facteurs: ReadmissionFactor[];
}
