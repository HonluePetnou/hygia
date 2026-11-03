import { describe, expect, it, vi } from 'vitest';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  CopiloteViewModel,
  DashboardViewModel,
  HttpCopiloteGateway,
  InMemoryCopiloteGateway,
  InMemoryIngestionGateway,
  InMemoryPatientsGateway,
  IngestionViewModel,
  PatientRecordViewModel,
  SessionViewModel,
} from '../src/index.js';

const patients = () => new InMemoryPatientsGateway(demoDataset, () => '2026-10-28');

describe('SessionViewModel', () => {
  it('connecte avec le bon code', async () => {
    const session = new SessionViewModel();
    expect(await session.submitCredentials('nana@hygia.test', 'secret')).toBe(true);
    expect(session.step).toBe('code');
    expect(await session.submitCode('481516')).toBe(true);
    expect(session.isAuthenticated).toBe(true);
    expect(session.errorMessage).toBeNull();
  });

  it('refuse un mauvais code, un code mal formé et des identifiants vides', async () => {
    const session = new SessionViewModel();
    expect(await session.submitCredentials('', '')).toBe(false);
    expect(session.errorMessage).toBe('Identifiants invalides');
    await session.submitCredentials('nana@hygia.test', 'secret');
    expect(await session.submitCode('000000')).toBe(false);
    expect(await session.submitCode('48151')).toBe(false);
    expect(session.isAuthenticated).toBe(false);
    expect(session.errorKey).toBe('mfa.error');
  });

  it('bascule de langue : les libellés changent', () => {
    const session = new SessionViewModel();
    const dashboard = new DashboardViewModel(patients(), session);
    expect(dashboard.title).toBe('Tableau de bord');
    expect(session.roleLabel).toBe('Médecin');
    session.toggleLocale();
    expect(session.locale).toBe('en');
    expect(dashboard.title).toBe('Dashboard');
    expect(session.roleLabel).toBe('Doctor');
  });
});

describe('DashboardViewModel', () => {
  it('expose indicateurs, consultations du jour et alertes traduites', async () => {
    const session = new SessionViewModel();
    const dashboard = new DashboardViewModel(patients(), session);
    await dashboard.load();
    expect(dashboard.state).toBe('ready');
    expect(dashboard.consultations).toHaveLength(1);
    expect(dashboard.indicators.map((i) => i.value)).toEqual([1, 4, 2, 3]);
    expect(dashboard.consultations[0]).toMatchObject({ status: 'alert', time: '09:00' });
    expect(dashboard.documents).toHaveLength(3);
    expect(dashboard.week).toHaveLength(7);
    expect(dashboard.alerts).toHaveLength(4);
    expect(dashboard.alerts.some((a) => a.text.includes('warfarine × ibuprofène'))).toBe(true);
  });

  it('passe en erreur si la passerelle échoue', async () => {
    const gateway = patients();
    vi.spyOn(gateway, 'dashboard').mockRejectedValue(new Error('x'));
    const dashboard = new DashboardViewModel(gateway, new SessionViewModel());
    await dashboard.load();
    expect(dashboard.state).toBe('error');
    expect(dashboard.errorMessage).toBe('Une erreur est survenue.');
  });
});

describe('PatientRecordViewModel', () => {
  it('filtre la chronologie', async () => {
    const session = new SessionViewModel();
    const record = new PatientRecordViewModel(patients(), session);
    await record.load(FLORENCE_ID);
    expect(record.fullName).toBe('Florence Ngo Bassa');
    const all = record.visibleTimeline.length;
    expect(all).toBeGreaterThan(8);
    record.setFilter('prescriptions');
    expect(record.visibleTimeline.map((e) => e.type)).toEqual(['prescription', 'prescription']);
    record.setFilter('consultations');
    expect(record.visibleTimeline).toHaveLength(1);
    record.setFilter('all');
    expect(record.visibleTimeline).toHaveLength(all);
    record.dispose();
  });

  it('recharge le résumé quand la langue change', async () => {
    const session = new SessionViewModel();
    const record = new PatientRecordViewModel(patients(), session);
    await record.load(FLORENCE_ID);
    expect(record.summary?.titres.antecedents).toBe('Antécédents');
    session.setLocale('en');
    await vi.waitFor(() => expect(record.summary?.titres.antecedents).toBe('History'));
    expect(record.filters[0]?.label).toBe('All');
    record.dispose();
  });

  it('signale une erreur de chargement', async () => {
    const gateway = patients();
    vi.spyOn(gateway, 'patient').mockRejectedValue(new Error('404'));
    const record = new PatientRecordViewModel(gateway, new SessionViewModel());
    await record.load('inconnu');
    expect(record.state).toBe('error');
    record.dispose();
  });
});

describe('CopiloteViewModel', () => {
  it('envoie une question et reçoit une réponse sourcée', async () => {
    const copilote = new CopiloteViewModel(
      new InMemoryCopiloteGateway(demoDataset),
      new SessionViewModel(),
    );
    copilote.open(FLORENCE_ID);
    copilote.setDraft('Quel est le dernier INR ?');
    expect(copilote.canSend).toBe(true);
    await copilote.send();
    expect(copilote.messages.map((m) => m.author)).toEqual(['user', 'assistant']);
    expect(copilote.messages[1]?.sources.length).toBeGreaterThan(0);
    expect(copilote.draft).toBe('');
    expect(copilote.pending).toBe(false);
  });

  it('dit explicitement quand aucune source ne permet de répondre', async () => {
    const copilote = new CopiloteViewModel(
      new InMemoryCopiloteGateway(demoDataset),
      new SessionViewModel(),
    );
    copilote.open(FLORENCE_ID);
    copilote.setDraft('Quelle est la couleur du ciel ?');
    await copilote.send();
    expect(copilote.messages[1]?.sources).toEqual([]);
    expect(copilote.messages[1]?.text).toContain('Aucune source');
  });

  it('ignore une question vide', async () => {
    const copilote = new CopiloteViewModel(
      new InMemoryCopiloteGateway(demoDataset),
      new SessionViewModel(),
    );
    copilote.open(FLORENCE_ID);
    copilote.setDraft('   ');
    await copilote.send();
    expect(copilote.messages).toEqual([]);
  });
});

describe('IngestionViewModel', () => {
  it('suit les étapes avec statut et durée', async () => {
    const ingestion = new IngestionViewModel(
      new InMemoryIngestionGateway(),
      new SessionViewModel(),
    );
    expect(ingestion.canStart).toBe(false);
    ingestion.chooseFile({ name: 'ordonnance.png' });
    expect(ingestion.stepViews.every((s) => s.status === 'pending')).toBe(true);
    await ingestion.start();
    expect(ingestion.stepViews.map((s) => s.status)).toEqual(Array(5).fill('done'));
    expect(ingestion.stepViews[1]).toMatchObject({ label: 'OCR', durationMs: 340 });
    expect(ingestion.failed).toBe(false);
  });

  it('signale un échec d’étape', async () => {
    const ingestion = new IngestionViewModel(
      new InMemoryIngestionGateway('ocr'),
      new SessionViewModel(),
    );
    ingestion.chooseFile({ name: 'scan.pdf' });
    await ingestion.start();
    expect(ingestion.failed).toBe(true);
    expect(ingestion.stepViews.map((s) => s.status)).toEqual([
      'done',
      'failed',
      'pending',
      'pending',
      'pending',
    ]);
  });
});

describe('accès refusé et bris de glace', () => {
  const outsider = () =>
    new InMemoryPatientsGateway(demoDataset, () => '2026-10-28', () => ({
      userId: 'inconnu',
      role: 'medecin',
    }));

  it('passe en « forbidden » hors équipe, puis recharge après le bris de glace', async () => {
    const record = new PatientRecordViewModel(outsider(), new SessionViewModel());
    await record.load(FLORENCE_ID);
    expect(record.state).toBe('forbidden');
    record.breakGlass.open();
    expect(record.breakGlass.canSubmit).toBe(false);
    record.breakGlass.setPrecisions('Admise aux urgences, inconsciente');
    await record.breakGlass.submit();
    expect(record.breakGlass.isOpen).toBe(false);
    expect(record.state).toBe('ready');
    expect(record.fullName).toBe('Florence Ngo Bassa');
    record.dispose();
  });

  it('laisse passer un membre de l’équipe de soins', async () => {
    const session = new SessionViewModel();
    const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-10-28', () => session.identity);
    const record = new PatientRecordViewModel(gateway, session);
    await record.load(FLORENCE_ID);
    expect(record.state).toBe('ready');
    expect(record.badges.map((b) => b.id)).toContain('anticoagulant');
    record.dispose();
  });

  it('recherche par nom ou IPP', async () => {
    const gateway = patients();
    expect(await gateway.search('florence')).toHaveLength(2);
    expect(await gateway.search('HYG-2024-00872')).toHaveLength(1);
    expect(await gateway.search('')).toHaveLength(9);
  });
});

describe('passerelle HTTP', () => {
  it('envoie le jeton Bearer et l’URL de base fournie, sans en-têtes d’identité simulés', async () => {
    const fetchFn = vi.fn(async () => Response.json({ answer: 'ok', language: 'fr', sources: [] }));
    const gateway = new HttpCopiloteGateway(
      'http://broker.test/',
      () => ({ userId: 'u-1', role: 'medecin', token: 'jwt.abc' }),
      fetchFn as unknown as typeof fetch,
    );
    await gateway.ask('p 1', 'Bonjour');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://broker.test/copilote/p%201');
    expect(init.headers).toMatchObject({ authorization: 'Bearer jwt.abc' });
    expect(init.headers).not.toHaveProperty('x-user-id');
    expect(init.body).toBe(JSON.stringify({ question: 'Bonjour' }));
  });
});
