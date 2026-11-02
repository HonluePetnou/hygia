import { describe, expect, it } from 'vitest';
import { demoDataset, REQUIRED_FIELDS, validateResource } from '../src/index.js';

const allResources = Object.values(demoDataset).flat();

describe('validateResource', () => {
  it.each(Object.keys(REQUIRED_FIELDS).filter((t) => t !== 'DetectedIssue' && t !== 'AuditEvent'))(
    'accepte un %s valide du jeu de démo et refuse sa version tronquée',
    (type) => {
      const sample = allResources.find((r) => r.resourceType === type);
      expect(sample).toBeDefined();
      expect(validateResource(sample)).toEqual({ ok: true });
      const first = REQUIRED_FIELDS[type]![0]!;
      const broken: Record<string, unknown> = { ...sample };
      delete broken[first];
      const result = validateResource(broken);
      expect(result.ok).toBe(false);
    },
  );

  it('valide DetectedIssue et AuditEvent', () => {
    const subject = { reference: 'Patient/x' };
    const issue = {
      resourceType: 'DetectedIssue',
      id: '00000000-0000-4000-8000-000000000001',
      version: 1,
      subject,
      agent: 'interactions',
      severity: 'high',
      explanation: 'Warfarine + ibuprofène',
      sources: [{ document: subject, excerpt: 'x' }],
      decision: { status: 'pending' },
    };
    const audit = {
      resourceType: 'AuditEvent',
      id: '00000000-0000-4000-8000-000000000002',
      version: 1,
      actor: { id: 'u1', role: 'medecin' },
      action: 'read',
      resource: subject,
      reason: 'soins',
      recordedAt: '2026-11-02T10:00:00Z',
      lamport: 1,
      previousHash: '',
      hash: 'abc',
    };
    expect(validateResource(issue)).toEqual({ ok: true });
    expect(validateResource(audit)).toEqual({ ok: true });
    expect(validateResource({ ...issue, sources: undefined }).ok).toBe(false);
    expect(validateResource({ ...audit, hash: undefined }).ok).toBe(false);
  });

  it('refuse un resourceType inconnu, un id invalide et une version invalide', () => {
    expect(validateResource({ resourceType: 'Nope' }).ok).toBe(false);
    expect(validateResource(null).ok).toBe(false);
    const patient = demoDataset.patients[0]!;
    expect(validateResource({ ...patient, id: 'pas-un-uuid' }).ok).toBe(false);
    expect(validateResource({ ...patient, version: 0 }).ok).toBe(false);
    expect(validateResource({ ...patient, version: 1.5 }).ok).toBe(false);
  });

  it('refuse une langue de document hors fr|en', () => {
    const document = { ...demoDataset.documents[0]!, language: 'de' };
    expect(validateResource(document).ok).toBe(false);
  });
});
