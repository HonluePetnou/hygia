import type { PatientRecord } from '../offline/patient-store.js';

const org = { reference: 'Organization/csi-mora', display: 'CSI de Mora' };

/** Dossiers fictifs chargés au premier lancement (maquette 15, données fictives uniquement). */
export const DEMO_PATIENTS: readonly PatientRecord[] = [
  {
    id: 'a3f1c0de-0001-4a00-8000-000000000001',
    ipp: 'HYG-2026-00101',
    familyName: 'Alhadji',
    givenName: 'Fadimatou',
    birthDate: '1953-03-14',
    gender: 'female',
    managingOrganization: org,
    condition: 'Diabète type 2',
    reason: 'Glycémie à contrôler',
  },
  {
    id: 'a3f1c0de-0002-4a00-8000-000000000002',
    ipp: 'HYG-2026-00102',
    familyName: 'Moussa',
    givenName: 'Abba',
    birthDate: '2020-06-02',
    gender: 'male',
    managingOrganization: org,
    condition: 'Paludisme simple',
    reason: 'TDR positif hier',
  },
  {
    id: 'a3f1c0de-0003-4a00-8000-000000000003',
    ipp: 'HYG-2026-00103',
    familyName: 'Hadjara',
    givenName: 'Daouda',
    birthDate: '1997-01-20',
    gender: 'female',
    managingOrganization: org,
    condition: 'Grossesse 32 SA',
    reason: 'Consultation prénatale',
  },
  {
    id: 'a3f1c0de-0004-4a00-8000-000000000004',
    ipp: 'HYG-2026-00104',
    familyName: 'Oumarou',
    givenName: 'Bello',
    birthDate: '1972-09-08',
    gender: 'male',
    managingOrganization: org,
    condition: 'HTA',
    reason: 'Renouvellement traitement',
  },
  {
    id: 'a3f1c0de-0005-4a00-8000-000000000005',
    ipp: 'HYG-2026-00417',
    familyName: 'Kaltouma',
    givenName: 'Zara',
    birthDate: '1985-04-30',
    gender: 'female',
    managingOrganization: org,
    condition: 'Gastro-entérite',
    reason: 'Déshydratation à surveiller',
  },
];
