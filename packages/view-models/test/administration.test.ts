import { describe, expect, it } from 'vitest';
import {
  AdministrationViewModel,
  GatewayError,
  HttpAdministrationGateway,
  InMemoryAdministrationGateway,
  SessionViewModel,
  type AdministrationGateway,
} from '../src/index.js';

const ADMIN_ID = '00000000-0000-4000-8000-020000000007';

async function setup(gateway: AdministrationGateway = new InMemoryAdministrationGateway()) {
  const session = new SessionViewModel({ role: 'admin' });
  const vm = new AdministrationViewModel(gateway, { locale: session.locale, t: session.t, userId: ADMIN_ID });
  await vm.load();
  return vm;
}

describe('AdministrationViewModel', () => {
  it('liste les utilisateurs avec rôle, équipes, 2FA et dernière connexion', async () => {
    const vm = await setup();
    expect(vm.state).toBe('ready');
    expect(vm.rows[0]).toMatchObject({
      name: 'Dr Aïcha Nana',
      roleLabel: 'Médecin',
      teamNames: ['Cardiologie'],
      mfaEnrolled: true,
      // 08:12 UTC, affiché à l'heure du Cameroun (UTC+1).
      lastLoginLabel: '03/11/2026 09:12',
    });
    expect(vm.rows.find((r) => r.name === 'Dr Paul Kamga')).toMatchObject({ mfaEnrolled: false, lastLoginLabel: 'Jamais' });
    expect(vm.policy).toEqual({ mfaRequired: true, sessionMinutes: 30, breakGlassHours: 4, passwordLength: 12 });
  });

  it('invitation : compte créé, mot de passe provisoire montré, action auditée', async () => {
    const gateway = new InMemoryAdministrationGateway();
    const vm = await setup(gateway);
    const ok = await vm.invite({ email: 'sam@hd-bonassama.cm', displayName: 'Samuel T.', role: 'infirmier' });
    expect(ok).toBe(true);
    expect(vm.temporaryPassword).not.toBeNull();
    expect(vm.rows.find((r) => r.email === 'sam@hd-bonassama.cm')).toMatchObject({ roleLabel: 'Infirmier', mfaEnrolled: false });
    expect(gateway.audited.some((line) => line.startsWith('invitation:'))).toBe(true);
    vm.dismissPassword();
    expect(vm.temporaryPassword).toBeNull();
  });

  it('invitation avec une adresse déjà utilisée : erreur « conflict », liste inchangée', async () => {
    const vm = await setup();
    const before = vm.rows.length;
    expect(await vm.invite({ email: 'AICHA.NANA@hd-bonassama.cm', displayName: 'Doublon', role: 'medecin' })).toBe(false);
    expect(vm.error).toBe('conflict');
    expect(vm.rows).toHaveLength(before);
  });

  it('change le rôle, réinitialise la 2FA, désactive puis réactive, chaque action auditée', async () => {
    const gateway = new InMemoryAdministrationGateway();
    const vm = await setup(gateway);
    const nana = vm.rows[0]!.id;
    await vm.changeRole(nana, 'infirmier');
    await vm.resetMfa(nana);
    await vm.setActive(nana, false);
    expect(vm.rows[0]).toMatchObject({ roleLabel: 'Infirmier', mfaEnrolled: false, active: false });
    await vm.setActive(nana, true);
    expect(vm.rows[0]?.active).toBe(true);
    expect(gateway.audited).toEqual([
      `role:${nana}:infirmier`,
      `2fa:${nana}`,
      `desactivation:${nana}`,
      `reactivation:${nana}`,
    ]);
  });

  it('équipes : création, ajout et retrait de membres, patients rattachés', async () => {
    const vm = await setup();
    await vm.createTeam('  Urgences ');
    const urgences = vm.teams.find((t) => t.name === 'Urgences')!;
    expect(urgences.members).toEqual([]);
    expect(urgences.candidates.length).toBe(vm.rows.length);
    const kamga = vm.rows.find((r) => r.name === 'Dr Paul Kamga')!.id;
    await vm.addMember(urgences.id, kamga);
    expect(vm.rows.find((r) => r.id === kamga)?.teamNames).toEqual(['Urgences']);
    expect(vm.teams.find((t) => t.id === urgences.id)?.candidates.some((c) => c.id === kamga)).toBe(false);
    await vm.attachPatient(urgences.id, ' p-9 ');
    expect(vm.teams.find((t) => t.id === urgences.id)?.patientIds).toEqual(['p-9']);
    await vm.detachPatient(urgences.id, 'p-9');
    await vm.removeMember(urgences.id, kamga);
    expect(vm.teams.find((t) => t.id === urgences.id)).toMatchObject({ members: [], patientIds: [] });
  });

  it('isSelf identifie le compte connecté', async () => {
    const vm = await setup();
    expect(vm.isSelf(ADMIN_ID)).toBe(true);
    expect(vm.isSelf('autre')).toBe(false);
  });

  it('403 au chargement : état « forbidden » ; échec d’action : erreur sans perdre les données', async () => {
    const denied = new InMemoryAdministrationGateway();
    denied.load = () => Promise.reject(new GatewayError(403, 'GET /comptes'));
    expect((await setup(denied)).state).toBe('forbidden');

    const flaky = new InMemoryAdministrationGateway();
    const vm = await setup(flaky);
    flaky.resetMfa = () => Promise.reject(new GatewayError(500, 'POST'));
    expect(await vm.resetMfa('x')).toBe(false);
    expect(vm.error).toBe('failed');
    expect(vm.state).toBe('ready');
  });
});

describe('HttpAdministrationGateway', () => {
  it('appelle les routes du service Identité avec le jeton', async () => {
    const calls: { url: string; method: string; body: unknown; auth: string | null }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        body: init.body === undefined ? undefined : JSON.parse(init.body as string),
        auth: new Headers(init.headers).get('authorization'),
      });
      return new Response(JSON.stringify(url.endsWith('/comptes') || url.endsWith('/equipes') ? [] : {}), { status: 200 });
    }) as unknown as typeof fetch;
    const gateway = new HttpAdministrationGateway('http://b/api/identite', () => ({ userId: 'u', role: 'admin', token: 'jwt' }), fetchFn);
    await gateway.load();
    await gateway.invite({ email: 'a@b.cm', displayName: 'A', role: 'medecin', teamId: 't' });
    await gateway.changeRole('c1', 'infirmier');
    await gateway.resetMfa('c1');
    await gateway.setActive('c1', false);
    await gateway.setActive('c1', true);
    await gateway.createTeam('Urgences');
    await gateway.addMember('t1', 'c1');
    await gateway.removeMember('t1', 'c1');
    await gateway.attachPatient('t1', 'p1');
    await gateway.detachPatient('t1', 'p1');
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://b/api/identite', '')}`)).toEqual([
      'GET /comptes',
      'GET /equipes',
      'POST /comptes/invitations',
      'POST /comptes/c1/role',
      'POST /comptes/c1/reinitialiser-2fa',
      'POST /comptes/c1/desactiver',
      'POST /comptes/c1/reactiver',
      'POST /equipes',
      'POST /equipes/t1/membres',
      'POST /equipes/t1/membres/retirer',
      'POST /equipes/t1/patients',
      'POST /equipes/t1/patients/retirer',
    ]);
    expect(calls[3]?.body).toEqual({ role: 'infirmier' });
    expect(calls.every((c) => c.auth === 'Bearer jwt')).toBe(true);
  });
});
