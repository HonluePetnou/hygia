import { AuditLog } from '@hygia/audit';
import { ForwardingAuditStore } from '../src/audit/forwarding-audit-store.js';
import { loadEnv } from '../src/config/env.js';

const FLORENCE = '00000000-0000-4000-8000-030000000001';
const KAMGA = '00000000-0000-4000-8000-020000000003';

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Faux `fetch` : enregistre les envois ; `fail` fait échouer les prochains appels. */
function fakeFetch() {
  const sent: Sent[] = [];
  const state = { fail: false };
  const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (state.fail) throw new Error('ECONNREFUSED');
    sent.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response('{}', { status: 201 });
  };
  return { sent, state, fetchFn: fetchFn as typeof fetch };
}

function store(fetchFn: typeof fetch) {
  return new ForwardingAuditStore({
    url: 'http://audit.test',
    key: 'cle-test',
    resolveActor: (id) => (id === KAMGA ? 'Dr Paul Kamga' : undefined),
    fetchFn,
    warn: () => undefined,
  });
}

const entry = (action: 'lecture' | 'bris_de_glace', reason: string) => ({
  actor: KAMGA,
  role: 'medecin' as const,
  action,
  resourceType: 'Patient',
  resourceId: FLORENCE,
  patientId: FLORENCE,
  reason,
});

describe('transmission du journal de Dossiers au service Audit', () => {
  it('garde le journal local chaîné et transmet chaque entrée, nom et motif lisibles', async () => {
    const { sent, fetchFn } = fakeFetch();
    const forwarding = store(fetchFn);
    const log = new AuditLog(forwarding);

    log.append(entry('bris_de_glace', 'Urgence vitale'));
    log.append(entry('lecture', 'bris_de_glace'));
    await forwarding.flush();

    expect(log.events()).toHaveLength(2);
    expect(log.events()[0]?.actor).toBe(KAMGA);
    expect(log.verify()).toEqual({ intact: true });

    expect(sent.map((s) => s.url)).toEqual([
      'http://audit.test/internal/events',
      'http://audit.test/internal/events',
    ]);
    expect(sent[0]?.headers['x-internal-key']).toBe('cle-test');
    expect(sent[0]?.body).toEqual({
      actor: 'Dr Paul Kamga',
      role: 'medecin',
      action: 'bris_de_glace',
      resourceType: 'Patient',
      resourceId: FLORENCE,
      patientId: FLORENCE,
      reason: 'Urgence vitale',
    });
    expect(sent[1]?.body['reason']).toBe("Accès d'urgence (bris de glace)");
  });

  it('garde l’identifiant quand le nom est inconnu, et rend le motif « soins » lisible', async () => {
    const { sent, fetchFn } = fakeFetch();
    const forwarding = store(fetchFn);
    new AuditLog(forwarding).append({ ...entry('lecture', 'soins'), actor: 'inconnu-42' });
    await forwarding.flush();
    expect(sent[0]?.body['actor']).toBe('inconnu-42');
    expect(sent[0]?.body['reason']).toBe('Soins');
  });

  it('rend lisibles tous les motifs codés de Dossiers', async () => {
    const { sent, fetchFn } = fakeFetch();
    const forwarding = store(fetchFn);
    const log = new AuditLog(forwarding);
    log.append(entry('lecture', 'equipe'));
    log.append(entry('lecture', 'droit_acces'));
    await forwarding.flush();
    expect(sent.map((s) => s.body['reason'])).toEqual([
      'Soins',
      'Accès de la personne à son propre dossier',
    ]);
  });

  it('service Audit injoignable : le journal local continue, les entrées partent au retour, dans l’ordre', async () => {
    const { sent, state, fetchFn } = fakeFetch();
    const forwarding = store(fetchFn);
    const log = new AuditLog(forwarding);

    state.fail = true;
    log.append(entry('bris_de_glace', 'Urgence vitale'));
    await forwarding.flush();
    expect(log.events()).toHaveLength(1);
    expect(sent).toHaveLength(0);

    state.fail = false;
    log.append(entry('lecture', 'bris_de_glace'));
    await forwarding.flush();
    expect(sent.map((s) => s.body['action'])).toEqual(['bris_de_glace', 'lecture']);
  });
});

describe('configuration du journal d’audit', () => {
  it('sans AUDIT_URL, rien n’est transmis', () => {
    expect(loadEnv({}).audit).toBeUndefined();
  });

  it('AUDIT_URL et AUDIT_INTERNAL_KEY activent la transmission', () => {
    expect(
      loadEnv({ AUDIT_URL: 'http://localhost:3005', AUDIT_INTERNAL_KEY: 'k' }).audit,
    ).toEqual({ url: 'http://localhost:3005', key: 'k' });
  });

  it('AUDIT_URL sans clé est refusée', () => {
    expect(() => loadEnv({ AUDIT_URL: 'http://localhost:3005' })).toThrow(/AUDIT_INTERNAL_KEY/);
  });
});
