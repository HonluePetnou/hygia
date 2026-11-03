import { FLORENCE_ID } from '@hygia/fhir';
import { describe, expect, it } from 'vitest';
import {
  AuditViewModel,
  GatewayError,
  HttpPortalGateway,
  InMemoryAuditGateway,
  InMemoryPortalGateway,
  PortalViewModel,
  SessionViewModel,
  type PortalGateway,
} from '../src/index.js';

function build(portal: PortalGateway = new InMemoryPortalGateway('en')) {
  const audit = new InMemoryAuditGateway();
  const session = new SessionViewModel({
    userId: FLORENCE_ID,
    displayName: 'Florence Ngo Bassa',
    role: 'patient',
  });
  return { audit, session, vm: new PortalViewModel(portal, audit, session) };
}

describe('PortalViewModel', () => {
  it('charge les consentements, le rendez-vous et le journal, et adopte la langue du patient', async () => {
    const { vm, session } = build();
    await vm.load();
    expect(vm.state).toBe('ready');
    expect(session.locale).toBe('en');
    expect(vm.firstName).toBe('Florence');
    expect(vm.consents.map((c) => [c.purpose, c.granted])).toEqual([
      ['soins', true],
      ['ia', true],
      ['statistiques', true],
      ['audio', false],
      ['whatsapp', true],
    ]);
    expect(vm.appointment?.clinician).toBe('Dr Aïcha Nana');
    expect(vm.rows).toHaveLength(5);
    expect(vm.canShowAll).toBe(true);
    vm.toggleShowAll();
    expect(vm.rows).toHaveLength(7);
  });

  it('classe les accès : lecture, bris de glace avec motif, agent IA, ajout', async () => {
    const { vm } = build();
    await vm.load();
    vm.toggleShowAll();
    const breakGlass = vm.rows.find((r) => r.kind === 'breakGlass');
    expect(breakGlass?.sentence).toBe(
      'Emergency access — reason: Urgence vitale — patient inconscient',
    );
    expect(breakGlass?.badge).toBe('Break-glass');
    expect(vm.rows.find((r) => r.kind === 'agent')?.initials).toBe('IA');
    expect(vm.rows.some((r) => r.kind === 'add')).toBe(true);
  });

  it('révoque puis redonne un consentement, mais jamais celui des soins', async () => {
    const { vm } = build();
    await vm.load();
    await vm.toggleConsent('ia');
    expect(vm.consentOf('ia')).toMatchObject({ granted: false, version: 2 });
    expect(vm.consentOf('ia')?.revokedAt).toBeDefined();
    await vm.toggleConsent('ia');
    expect(vm.consentOf('ia')).toMatchObject({ granted: true, version: 3 });
    await vm.toggleConsent('soins');
    expect(vm.consentOf('soins')).toMatchObject({ granted: true, version: 1 });
  });

  it('recharge et signale l’erreur si le consentement a été modifié ailleurs (409)', async () => {
    const memory = new InMemoryPortalGateway();
    const { vm } = build(memory);
    await vm.load();
    await memory.setConsent(FLORENCE_ID, 'ia', false, 1);
    await vm.toggleConsent('ia');
    expect(vm.noticeKey).toBe('portal.notice.error');
    expect(vm.noticeIsError).toBe(true);
    expect(vm.consentOf('ia')?.granted).toBe(false);
  });

  it('transmet un signalement et une demande de rectification à la DPO, visibles dans la vue de l’auditeur', async () => {
    const { vm, audit, session } = build();
    await vm.load();
    await vm.report(3);
    expect(vm.noticeKey).toBe('portal.notice.reported');
    await vm.request('rectification', 'Mon nom est mal orthographié');
    expect(vm.noticeKey).toBe('portal.notice.requested.rectification');

    const dpo = new AuditViewModel(audit, session);
    await dpo.load();
    expect(dpo.rightsRows.map((r) => r.kindLabel)).toEqual(['Correction', 'Reported access']);
    expect(dpo.rightsRows[0]?.message).toBe('Mon nom est mal orthographié');
    expect(dpo.rightsRows[0]?.dueAt).toBe('2026-11-27');
  });

  it('enregistre la langue choisie et distingue refus (403) et erreur', async () => {
    const memory = new InMemoryPortalGateway('fr');
    const { vm, session } = build(memory);
    await vm.changeLanguage('en');
    expect(session.locale).toBe('en');
    expect((await memory.consents(FLORENCE_ID)).language).toBe('en');

    const failing = (status: number): PortalGateway => ({
      consents: () => Promise.reject(new GatewayError(status, 'GET')),
      nextAppointment: () => Promise.resolve(null),
      setConsent: memory.setConsent.bind(memory),
      setLanguage: memory.setLanguage.bind(memory),
      downloadDossier: memory.downloadDossier.bind(memory),
    });
    const refused = build(failing(403)).vm;
    await refused.load();
    const broken = build(failing(500)).vm;
    await broken.load();
    expect([refused.state, broken.state]).toEqual(['forbidden', 'error']);
  });
});

describe('HttpPortalGateway', () => {
  it('appelle les consentements, la révocation et le prochain rendez-vous avec le jeton', async () => {
    const calls: { url: string; method: string; body: string | undefined; auth: string | null }[] =
      [];
    const fetchFn = ((input: string, init: RequestInit = {}) => {
      calls.push({
        url: input,
        method: init.method ?? 'GET',
        body: init.body as string | undefined,
        auth: new Headers(init.headers).get('authorization'),
      });
      return Promise.resolve(
        input.endsWith('/prochain')
          ? new Response('{}', { status: 404 })
          : new Response('{}', { status: 200 }),
      );
    }) as typeof fetch;
    const gateway = new HttpPortalGateway(
      { dossiersUrl: 'http://b/api/dossiers', notificationUrl: 'http://b/api/notification' },
      () => ({ userId: FLORENCE_ID, role: 'patient', token: 'jwt' }),
      fetchFn,
    );
    await gateway.setConsent(FLORENCE_ID, 'ia', false, 2);
    expect(await gateway.nextAppointment()).toBeNull();
    expect(calls[0]).toMatchObject({
      url: `http://b/api/dossiers/patients/${FLORENCE_ID}/consents/ia`,
      method: 'PUT',
      body: JSON.stringify({ granted: false, version: 2 }),
      auth: 'Bearer jwt',
    });
    expect(calls[1]?.url).toBe('http://b/api/notification/rendez-vous/prochain');
  });
});
