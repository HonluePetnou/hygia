import { demoCareTeams, demoOrganizations, demoPatients, demoPractitioners } from './demo-admin.js';
import {
  florenceAllergies,
  florenceConditions,
  florenceDocuments,
  florenceEncounters,
  florenceMedications,
  florenceObservations,
} from './demo-clinical.js';

/** Jeu de données fictif déterministe (aucune donnée réelle). */
export const demoDataset = {
  organizations: demoOrganizations,
  practitioners: demoPractitioners,
  patients: demoPatients,
  careTeams: demoCareTeams,
  documents: florenceDocuments,
  observations: florenceObservations,
  conditions: florenceConditions,
  medicationRequests: florenceMedications,
  allergies: florenceAllergies,
  encounters: florenceEncounters,
} as const;
