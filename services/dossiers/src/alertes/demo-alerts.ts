import { demoDataset } from '@hygia/fhir';
import type { AlertRecord } from './alert.js';

const steps = (texts: string[]) => texts.map((text, index) => ({ step: index + 1, text }));
const pad = (n: number): string => String(n).padStart(2, '0');
const source = (n: number, display: string, excerpt: string) => ({
  document: { reference: `DocumentReference/00000000-0000-4000-8000-0b000000${pad(n)}00`, display },
  excerpt,
});
const alertId = (n: number): string => `00000000-0000-4000-8000-0a000000${pad(n)}00`;

/** Quatre alertes fictives ouvertes (maquette 07), toutes sur Florence, seule patiente suivie par l'équipe de démonstration (contrôle d'accès). */
export function demoAlerts(): AlertRecord[] {
  const florence = demoDataset.patients[0];
  const base = { resourceType: 'DetectedIssue', version: 1, decision: { status: 'pending' } } as const;
  return [
    {
      ...base,
      id: alertId(1),
      patientId: florence?.id as string,
      agent: 'pharmacovigilance',
      severity: 'high',
      title: 'Interaction majeure : warfarine × ibuprofène — risque hémorragique',
      reasoning: steps([
        'Nouvelle prescription reçue : ibuprofène 400 mg × 3/j, 5 jours (photo WhatsApp, 28/10).',
        'Traitement actif trouvé dans le dossier : warfarine 5 mg/j depuis 2021, INR cible 2–3.',
        'Règle d’interaction appliquée : AINS + antivitamine K, majoration du risque hémorragique.',
        'Contexte patient pris en compte : 71 ans, dernier INR à 2,8 : gravité relevée à « critique ».',
      ]),
      sources: [
        source(1, 'Ordonnance WhatsApp · 28/10', 'Ibuprofène 400 mg : 1 cp × 3/j pendant 5 jours'),
        source(2, 'CR cardio · 12/09', 'Warfarine 5 mg/j, INR cible 2–3'),
        source(3, 'Bilan INR · 14/10', 'INR 2,8'),
      ],
      proposal:
        'Remplacer l’ibuprofène par du paracétamol, contrôler l’INR sous 72 h et prévenir le prescripteur. Aucune modification n’est appliquée sans votre validation.',
      raisedAt: '2026-11-02T10:26:00Z',
    },
    {
      ...base,
      id: alertId(2),
      patientId: florence?.id as string,
      agent: 'pharmacovigilance',
      severity: 'high',
      title: 'Allergie connue à la pénicilline — amoxicilline prescrite',
      reasoning: steps([
        'Nouvelle prescription reçue : amoxicilline 1 g × 2/j.',
        'Allergie documentée dans le dossier : pénicilline (réaction cutanée).',
        'Règle appliquée : l’amoxicilline appartient à la famille des pénicillines.',
      ]),
      sources: [
        source(4, 'Ordonnance · 02/11', 'Amoxicilline 1 g × 2/j'),
        source(5, 'Fiche allergies', 'Pénicilline : urticaire'),
      ],
      proposal: 'Choisir une classe d’antibiotique alternative et prévenir le prescripteur.',
      raisedAt: '2026-11-02T10:10:00Z',
    },
    {
      ...base,
      id: alertId(3),
      patientId: florence?.id as string,
      agent: 'quality',
      severity: 'moderate',
      title: 'Créatininémie 1 450 µmol/L : valeur aberrante ?',
      reasoning: steps([
        'Résultat extrait du compte rendu de biologie : créatinine 1 450 µmol/L.',
        'Valeur plus de dix fois supérieure à la borne haute habituelle.',
        'Hypothèse d’une erreur d’unité ou de saisie.',
      ]),
      sources: [source(6, 'Bilan biologique · 02/11', 'Créatinine 1450 µmol/L')],
      proposal: 'Vérifier la valeur sur le document d’origine avant de l’intégrer au dossier.',
      raisedAt: '2026-11-02T09:26:00Z',
    },
    {
      ...base,
      id: alertId(4),
      patientId: florence?.id as string,
      agent: 'pharmacovigilance',
      severity: 'moderate',
      title: 'Doublon thérapeutique : 2 IEC prescrits',
      reasoning: steps([
        'Deux prescriptions actives d’inhibiteurs de l’enzyme de conversion.',
        'Règle appliquée : une seule molécule de cette classe par patient.',
      ]),
      sources: [source(7, 'Ordonnance · 30/10', 'Ramipril 5 mg et périndopril 4 mg')],
      proposal: 'Conserver un seul IEC et arrêter l’autre.',
      raisedAt: '2026-11-01T10:00:00Z',
    },
  ];
}
