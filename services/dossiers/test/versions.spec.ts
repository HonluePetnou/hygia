import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { InMemoryDocumentStore } from '../src/versions/in-memory-document-store.js';
import { S3DocumentStore, type S3Operations } from '../src/versions/s3-document-store.js';

const KAMGA_ID = '00000000-0000-4000-8000-020000000003';
const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const DOC_ID = '00000000-0000-4000-8000-050000000001';

class FakeClock implements Clock {
  constructor(public current = new Date('2026-11-05T09:00:00Z')) {}
  now(): Date {
    return this.current;
  }
}

interface Version {
  number: number;
  author: string;
  createdAt: string;
  reason: string;
  resourceType: string;
  content: Record<string, unknown>;
}

describe('historique des versions (RF5)', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let issuer: TokenIssuer;
  let nana: Record<string, string>;
  let kamga: Record<string, string>;
  let auditeur: Record<string, string>;

  async function as(sub: string, role: Role, teams: string[] = []): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role, teams, emergency: [] }, clock.now());
    return { authorization: `Bearer ${token}` };
  }

  beforeEach(async () => {
    clock = new FakeClock();
    issuer = await TokenIssuer.create();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks(), () => clock.now()))
      .compile();
    app = module.createNestApplication();
    await app.init();
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    auditeur = await as('aud', 'auditeur');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const docUrl = `/documents/${DOC_ID}`;

  async function editTitle(version: number, title: string, motif: string): Promise<void> {
    clock.current = new Date(clock.current.getTime() + 60_000);
    await http().patch(docUrl).set(nana).set('If-Match', String(version)).send({ title, motif }).expect(200);
  }

  it('trois modifications produisent trois nouvelles versions, l’état initial restant lisible', async () => {
    await editTitle(1, 'Titre B', 'correction de frappe');
    await editTitle(2, 'Titre C', 'ajout de la date');
    await editTitle(3, 'Titre D', 'relecture du médecin');

    const list = await http().get(`${docUrl}/versions`).set(nana).expect(200);
    const versions = list.body as Version[];
    expect(versions.map((v) => v.number)).toEqual([1, 2, 3, 4]);
    expect(versions.slice(1).map((v) => [v.author, v.reason])).toEqual([
      [NANA_ID, 'correction de frappe'],
      [NANA_ID, 'ajout de la date'],
      [NANA_ID, 'relecture du médecin'],
    ]);
    expect(versions[3]?.createdAt).toBe('2026-11-05T09:03:00.000Z');
    expect(versions.map((v) => v.content['title'])).toEqual([
      'Consultation de cardiologie',
      'Titre B',
      'Titre C',
      'Titre D',
    ]);
  });

  it('une version ancienne reste lisible et inchangée après d’autres modifications', async () => {
    await editTitle(1, 'Titre B', 'correction');
    await editTitle(2, 'Titre C', 'seconde correction');

    const old = await http().get(`${docUrl}/versions/1`).set(nana).expect(200);
    expect((old.body as Version).content['title']).toBe('Consultation de cardiologie');
    expect((old.body as Version).author).toBe('système');
    const second = await http().get(`${docUrl}/versions/2`).set(nana).expect(200);
    expect((second.body as Version).content['title']).toBe('Titre B');
    await http().get(`${docUrl}/versions/9`).set(nana).expect(404);
    await http().get(`${docUrl}/versions/abc`).set(nana).expect(400);
  });

  it('chaque lecture de version est auditée', async () => {
    await editTitle(1, 'Titre B', 'correction');
    await http().get(`${docUrl}/versions`).set(nana).expect(200);
    await http().get(`${docUrl}/versions/1`).set(nana).expect(200);
    await http().get(`/patients/${FLORENCE_ID}/versions`).set(nana).expect(200);

    const log = await http().get(`/patients/${FLORENCE_ID}/acces`).set(auditeur).expect(200);
    const events = (log.body as { action: string; resourceType: string; actor: string }[]).filter(
      (e) => e.action === 'lecture',
    );
    expect(events.map((e) => e.resourceType)).toEqual([
      'DocumentVersions',
      'DocumentReference@v1',
      'PatientVersions',
    ]);
    expect(events.every((e) => e.actor === NANA_ID)).toBe(true);
  });

  it('historique du dossier : fiche patient et documents, du plus récent au plus ancien', async () => {
    await http()
      .patch(`/patients/${FLORENCE_ID}`)
      .set(nana)
      .set('If-Match', '1')
      .send({ givenName: 'Flo', motif: 'prénom d’usage' })
      .expect(200);
    await editTitle(1, 'Titre B', 'correction');

    const list = await http().get(`/patients/${FLORENCE_ID}/versions`).set(nana).expect(200);
    const versions = list.body as Version[];
    expect(versions.map((v) => [v.resourceType, v.number])).toEqual([
      ['DocumentReference', 2],
      ['DocumentReference', 1],
      ['Patient', 2],
      ['Patient', 1],
    ]);
    const patient = versions.find((v) => v.resourceType === 'Patient' && v.number === 2);
    expect(patient?.reason).toBe('prénom d’usage');
    expect(patient?.content['givenName']).toBe('Flo');
  });

  it('refuse l’accès hors équipe, sans jeton et sans motif ; 409 sur version périmée', async () => {
    await http().get(`${docUrl}/versions`).expect(401);
    await http().get(`${docUrl}/versions`).set(kamga).expect(403);
    await http().get(`${docUrl}/versions/1`).set(kamga).expect(403);
    await http().get(`/patients/${FLORENCE_ID}/versions`).set(kamga).expect(403);
    await http().get('/documents/00000000-0000-4000-8000-0500000000ff/versions').set(nana).expect(404);
    await http().patch(docUrl).set(nana).set('If-Match', '1').send({ title: 'X' }).expect(400);
    await editTitle(1, 'Titre B', 'correction');
    await http().patch(docUrl).set(nana).set('If-Match', '1').send({ title: 'Y', motif: 'm' }).expect(409);
    const list = await http().get(`${docUrl}/versions`).set(nana).expect(200);
    expect((list.body as Version[]).length).toBe(2);
  });
});

describe('DocumentStore', () => {
  const base = {
    resourceId: 'r1',
    resourceType: 'DocumentReference' as const,
    patientId: 'p1',
    author: 'a',
    createdAt: '2026-11-05T09:00:00Z',
    reason: 'm',
  };

  it('en mémoire : trois ajouts donnent trois versions immuables, un numéro ne se réécrit pas', async () => {
    const store = new InMemoryDocumentStore();
    for (const number of [1, 2, 3]) await store.append({ ...base, number, content: { title: `v${number}` } });
    expect((await store.list('r1')).map((v) => v.number)).toEqual([1, 2, 3]);
    await expect(store.append({ ...base, number: 2, content: {} })).rejects.toThrow();
    const first = await store.get('r1', 1);
    expect(() => {
      (first?.content as Record<string, unknown>)['title'] = 'altéré';
    }).toThrow();
    expect((await store.get('r1', 1))?.content['title']).toBe('v1');
  });

  it('S3 versionné : une version d’objet par ajout (client S3 simulé)', async () => {
    const objects: { key: string; body: string }[] = [];
    const fake: S3Operations = {
      putObject: async (key, body) => void objects.push({ key, body }),
      listVersions: async (prefix) =>
        objects
          .map((o, index) => ({ key: o.key, version: { versionId: String(index) } }))
          .filter((o) => o.key.startsWith(prefix)),
      getObject: async (_key, versionId) => objects[Number(versionId)]?.body ?? '',
    };
    const store = new S3DocumentStore(fake);
    await store.append({ ...base, number: 1, content: { title: 'a' } });
    await store.append({ ...base, number: 2, content: { title: 'b' } });
    expect(objects.map((o) => o.key)).toEqual(['resources/r1.json', 'resources/r1.json']);
    expect((await store.get('r1', 1))?.content['title']).toBe('a');
    expect((await store.listForPatient('p1')).length).toBe(2);
    await expect(store.append({ ...base, number: 2, content: {} })).rejects.toThrow();
  });
});
