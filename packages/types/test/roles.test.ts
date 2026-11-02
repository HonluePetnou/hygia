import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/index.js';

describe('ROLES', () => {
  it('contient les 7 rôles du cahier des charges', () => {
    expect([...ROLES].sort()).toEqual([
      'admin',
      'administratif',
      'analyste',
      'auditeur',
      'infirmier',
      'medecin',
      'patient',
    ]);
  });
});
