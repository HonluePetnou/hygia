import { describe, expect, it } from 'vitest';
import {
  AuditViewModel,
  GatewayError,
  HttpAuditGateway,
  InMemoryAuditGateway,
  SessionViewModel,
  type AuditGateway,
} from '../src/index.js';

describe('AuditViewModel', () => {
  it('charge les indicateurs, le chaînage et le tableau', async () => {
    const vm = new AuditViewModel(new InMemoryAuditGateway(), new SessionViewModel());
    await vm.load();
    expect(vm.state).toBe('ready');
    expect(vm.summary).toMatchObject({ eventsToday: 7, breakGlassToday: 1, chainBreaks: 0 });
    expect(vm.chainLabel).toBe('Chaîne intègre · vérifiée à 03:00');
    expect(vm.chain).toHaveLength(3);
    expect(vm.chain.at(-1)?.latest).toBe(true);
    expect(vm.rows[0]?.lamport).toBe(48196);
    const breakGlass = vm.rows.find((row) => row.action === 'bris_de_glace');
    expect(breakGlass).toMatchObject({ highlighted: true, actionLabel: 'Bris de glace', roleLabel: 'Médecin' });
  });

  it('filtre par catégorie et par texte, et revient à la page 1', async () => {
    const vm = new AuditViewModel(new InMemoryAuditGateway(), new SessionViewModel());
    await vm.load();
    await vm.setFilter('bris_de_glace');
    expect(vm.rows.map((row) => row.actor)).toEqual(['Dr B. Ondoa']);
    await vm.setFilter('tous');
    await vm.setText('mballa');
    expect(vm.total).toBe(1);
    await vm.setText('zzz');
    expect(vm.rows).toEqual([]);
  });

  it('pagine', async () => {
    const events = Array.from({ length: 23 }, (_, index) => ({
      index,
      lamport: index + 1,
      timestamp: '2026-10-28T08:00:00.000Z',
      actor: `u${index}`,
      role: 'medecin' as const,
      action: 'lecture' as const,
      resourceType: 'Patient',
      resourceId: `p${index}`,
      patientId: 'p',
      reason: 'soins',
      previousHash: '',
      hash: 'a'.repeat(64),
    }));
    const vm = new AuditViewModel(new InMemoryAuditGateway(events), new SessionViewModel());
    await vm.load();
    expect([vm.pageCount, vm.rows.length]).toEqual([3, 10]);
    await vm.goTo(3);
    expect(vm.rows.map((row) => row.lamport)).toEqual([3, 2, 1]);
    await vm.goTo(9);
    expect(vm.page).toBe(3);
  });

  it('signale une rupture de chaîne', async () => {
    const vm = new AuditViewModel(
      new InMemoryAuditGateway(undefined, undefined, false),
      new SessionViewModel(),
    );
    await vm.load();
    expect(vm.chainIntact).toBe(false);
    expect(vm.chainLabel).toBe('Rupture de chaîne à l’entrée 1');
    expect(vm.summary?.chainBreaks).toBe(1);
  });

  it('distingue refus (403) et erreur', async () => {
    const failing = (status: number): AuditGateway => ({
      summary: () => Promise.reject(new GatewayError(status, 'GET /summary')),
      search: () => Promise.reject(new GatewayError(status, 'GET /events')),
      exportCsv: () => Promise.reject(new GatewayError(status, 'GET /export.csv')),
    });
    const refused = new AuditViewModel(failing(403), new SessionViewModel());
    await refused.load();
    const broken = new AuditViewModel(failing(500), new SessionViewModel());
    await broken.load();
    expect([refused.state, broken.state]).toEqual(['forbidden', 'error']);
    expect(await broken.exportCsv()).toBeNull();
    expect(broken.exportFailed).toBe(true);
  });
});

describe('HttpAuditGateway', () => {
  it('appelle /events avec filtres et jeton', async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const fetchFn = ((input: string, init?: RequestInit) => {
      calls.push({ url: input, auth: new Headers(init?.headers).get('authorization') });
      return Promise.resolve(new Response(JSON.stringify({ items: [], total: 0, page: 2, pageSize: 10 })));
    }) as unknown as typeof fetch;
    const gateway = new HttpAuditGateway(
      'http://broker/api/audit/',
      () => ({ userId: 'u', role: 'auditeur', token: 'jwt' }),
      fetchFn,
    );
    await gateway.search({ filter: 'lectures', text: 'a b', page: 2, pageSize: 10 });
    expect(calls[0]).toEqual({
      url: 'http://broker/api/audit/events?categorie=lectures&q=a%20b&page=2&taille=10',
      auth: 'Bearer jwt',
    });
  });
});
