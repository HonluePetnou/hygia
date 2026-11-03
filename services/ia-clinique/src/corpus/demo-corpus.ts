import { demoDataset } from '@hygia/fhir';
import type { IndexedDocument } from '../index/passage-index.js';

/**
 * Texte fictif des 5 documents de Florence, dans l'ordre de `demoDataset.documents`
 * (consultation, hospitalisation, échographie en anglais, biologie, ordonnance).
 * Données fictives uniquement.
 */
const FLORENCE_TEXTS: readonly string[] = [
  [
    'Motif : suivi de fibrillation auriculaire sous warfarine 5 mg par jour.',
    'Examen stable, rythme irrégulier, aucun signe de décompensation.',
    "Conduite à tenir : contrôle de l'INR dans trois mois et poursuite de l'anticoagulant.",
  ].join('\n'),
  [
    "Hospitalisation pour décompensation d'une insuffisance cardiaque.",
    'Traitement diurétique par voie intraveineuse, bonne évolution en cinq jours.',
    'Sortie avec surveillance du poids ; allergie à la pénicilline notée au dossier.',
  ].join('\n'),
  [
    'Indication: follow-up of heart failure.',
    'The left ventricular ejection fraction (LVEF, FEVG in French) is 45%, mildly reduced.',
    'No significant valvular disease and no pericardial effusion.',
  ].join('\n'),
  [
    'Bilan biologique du 14 octobre 2026.',
    "L'INR est à 2,8, dans la cible thérapeutique de la warfarine.",
    'Fonction rénale et ionogramme sans anomalie.',
  ].join('\n'),
  [
    'Ordonnance du 28 octobre 2026 du Dr Aïcha Nana.',
    'Ibuprofène 400 mg, trois fois par jour, pendant cinq jours.',
    'Warfarine 5 mg, une fois par jour, à poursuivre.',
  ].join('\n'),
];

/**
 * Documents fictifs indexés par défaut (sortie simulée de la branche 6b d'ingestion).
 *
 * @throws Error si le jeu de données et les textes ne correspondent plus.
 */
export function buildDemoCorpus(documents = demoDataset.documents): IndexedDocument[] {
  if (documents.length !== FLORENCE_TEXTS.length) {
    throw new Error('Le corpus fictif ne correspond plus aux documents du jeu de données');
  }
  return documents.map((document, position) => ({
    documentId: document.id,
    patientId: document.subject.reference.split('/')[1] ?? '',
    title: document.title,
    date: document.date,
    language: document.language,
    text: FLORENCE_TEXTS[position] ?? '',
  }));
}
