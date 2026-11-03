import { demoCareTeams, demoOrganizations, demoPatients, demoPractitioners } from './demo-admin.js';
import {
  florenceAllergies,
  florenceConditions,
  florenceDocuments,
  florenceEncounters,
  florenceMedications,
  florenceObservations,
} from './demo-clinical.js';
import { doublonEncounters, doublonObservations, florenceDoublon } from './demo-doublon.js';

/** Jeu de données fictif déterministe (aucune donnée réelle). */
export const demoDataset = {
  organizations: demoOrganizations,
  practitioners: demoPractitioners,
  patients: [...demoPatients, florenceDoublon],
  careTeams: demoCareTeams,
  documents: florenceDocuments,
  observations: [...florenceObservations, ...doublonObservations],
  conditions: florenceConditions,
  medicationRequests: florenceMedications,
  allergies: florenceAllergies,
  encounters: [...florenceEncounters, ...doublonEncounters],
} as const;
