import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { IngestionOutcome, RawDocument } from '@hygia/ingestion';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { ChannelRegistry } from '../src/channels/channel-registry.js';
import { CHANNEL_SENDERS } from '../src/channels/channel-sender.js';
import { ConsoleSender } from '../src/channels/console-sender.js';
import { EmailSender, InMemoryEmailTransport } from '../src/channels/email-sender.js';
import { InMemorySnsPublisher, SmsSender } from '../src/channels/sms-sender.js';
import { SandboxWhatsAppApi, WhatsAppSender } from '../src/channels/whatsapp-sender.js';
import { CONSENT_GATE, type ConsentGate } from '../src/consent/consent-gate.js';
import { loadEnv } from '../src/config/env.js';
import { DEMO_RECIPIENTS } from '../src/demo-data.js';
import {
  APPOINTMENT_STORE,
  InMemoryAppointmentStore,
  type Appointment,
} from '../src/reminders/appointments.js';
import { CLOCK } from '../src/reminders/reminder.service.js';
import { DOCUMENT_INGESTOR } from '../src/whatsapp/whatsapp-webhook.service.js';

const FR = DEMO_RECIPIENTS[0]!;
const EN = DEMO_RECIPIENTS[1]!;
const NOW = new Date('2026-11-03T10:00:00Z');
const TOMORROW = '2026-11-04T09:00:00.000Z';
const INTERNAL = { 'x-internal-key': 'demo-notification-key' };
const WEBHOOK = { 'x-webhook-token': 'demo-whatsapp-token' };

const appointments = (): Appointment[] => [
  { id: 'a-fr', patientId: FR.patientId, startsAt: TOMORROW, status: 'scheduled' },
  { id: 'a-en', patientId: EN.patientId, startsAt: TOMORROW, status: 'scheduled' },
  {
    id: 'a-later',
    patientId: FR.patientId,
    startsAt: '2026-11-10T09:00:00.000Z',
    status: 'scheduled',
  },
];

/** Porte de consentement simulée : WhatsApp accordé sauf pour les patients refusés. */
class FakeConsentGate implements ConsentGate {
  readonly refused = new Set<string>();
  allows(patientId: string): Promise<boolean> {
    return Promise.resolve(!this.refused.has(patientId));
  }
}

describe('service Notification', () => {
  let consent: FakeConsentGate;
  let app: INestApplication;
  let whatsapp: SandboxWhatsAppApi;
  let sms: InMemorySnsPublisher;
  let store: InMemoryAppointmentStore;
  let ingested: RawDocument[];
  let ingestOutcome: IngestionOutcome;
  let role: string;
  let userId = 'u1';

  beforeEach(async () => {
    whatsapp = new SandboxWhatsAppApi();
    consent = new FakeConsentGate();
    sms = new InMemorySnsPublisher();
    store = new InMemoryAppointmentStore(appointments());
    ingested = [];
    ingestOutcome = { status: 'duplicate' };
    role = 'administratif';
    userId = 'u1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CHANNEL_SENDERS)
      .useValue([
        new WhatsAppSender(whatsapp),
        new SmsSender(sms),
        new EmailSender(new InMemoryEmailTransport()),
        new ConsoleSender(() => undefined),
      ])
      .overrideProvider(CONSENT_GATE)
      .useValue(consent)
      .overrideProvider(CLOCK)
      .useValue(() => NOW)
      .overrideProvider(APPOINTMENT_STORE)
      .useValue(store)
      .overrideProvider(DOCUMENT_INGESTOR)
      .useValue({
        ingest: async (document: RawDocument) => {
          ingested.push(document);
          return ingestOutcome;
        },
      })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({
        verify: async () => ({ sub: userId, role, teams: [], emergency: [] }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = { authorization: 'Bearer test' };
  const runReminders = () => request(app.getHttpServer()).post('/rappels/executer').set(auth);
  const inbound = (body: object) =>
    request(app.getHttpServer()).post('/webhooks/whatsapp').set(WEBHOOK).send(body);
  const event = (body: object) =>
    request(app.getHttpServer()).post('/events').set(INTERNAL).send(body);

  it('envoie le rappel de la veille en français et en anglais, avec « 1 » / « 2 »', async () => {
    const res = await runReminders().expect(201);
    expect(res.body).toEqual({ sent: ['a-fr', 'a-en'], failed: [] });
    expect(whatsapp.sent).toHaveLength(2);
    expect(whatsapp.sent[0]!.to).toBe(FR.phone);
    expect(whatsapp.sent[0]!.body).toContain('Répondez 1 pour confirmer, 2 pour reporter');
    expect(whatsapp.sent[0]!.body).toContain('4 nov. 2026');
    expect(whatsapp.sent[1]!.body).toContain('Reply 1 to confirm, 2 to reschedule');
    expect(whatsapp.sent[1]!.body).toContain('Nov 4, 2026');
  });

  it('n’envoie un rappel qu’une seule fois, même si l’envoi échoue (au plus une fois)', async () => {
    await runReminders().expect(201);
    const again = await runReminders().expect(201);
    expect(again.body).toEqual({ sent: [], failed: [] });
    expect(whatsapp.sent).toHaveLength(2);
  });

  it('ne rejoue pas un rappel dont l’envoi a échoué', async () => {
    const registry = app.get(ChannelRegistry);
    const original = registry.send.bind(registry);
    let calls = 0;
    registry.send = async (message, preference) => {
      if (calls++ === 0) throw new Error('panne');
      return original(message, preference);
    };
    const first = await runReminders().expect(201);
    expect(first.body.failed).toEqual(['a-fr']);
    const second = await runReminders().expect(201);
    expect(second.body.failed).toEqual([]);
    expect(store.get('a-fr')?.remindedAt).toBeDefined();
  });

  it('repli sur le SMS si WhatsApp est indisponible pour le patient', async () => {
    const registry = app.get(ChannelRegistry);
    whatsapp.sendText = async () => {
      throw new Error('sandbox down');
    };
    await registry.send({ recipient: FR, text: 'repli' }, ['whatsapp', 'sms']);
    expect(sms.published).toEqual([{ phoneNumber: FR.phone, message: 'repli' }]);
  });

  it('n’envoie aucun rappel WhatsApp à un patient qui l’a refusé : repli sur le SMS', async () => {
    consent.refused.add(FR.patientId);
    await runReminders().expect(201);
    expect(whatsapp.sent.map((m) => m.to)).toEqual([EN.phone]);
    expect(sms.published.map((m) => m.phoneNumber)).toEqual([FR.phone]);
  });

  it('indique au patient connecté son prochain rendez-vous, et à lui seul', async () => {
    const asPatient = async (sub: string) => {
      role = 'patient';
      userId = sub;
      return request(app.getHttpServer()).get('/rendez-vous/prochain').set(auth);
    };
    const mine = await asPatient(FR.patientId);
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({ id: 'a-fr', startsAt: TOMORROW });
    expect((await asPatient('inconnu')).status).toBe(404);
    role = 'medecin';
    await request(app.getHttpServer()).get('/rendez-vous/prochain').set(auth).expect(403);
  });

  it('confirme le rendez-vous quand la patiente répond « 1 »', async () => {
    await runReminders().expect(201);
    whatsapp.sent.length = 0;
    const res = await inbound({ from: FR.phone, type: 'text', text: '1' }).expect(200);
    expect(res.body).toEqual({ outcome: 'confirmed' });
    expect(store.get('a-fr')?.status).toBe('confirmed');
    expect(whatsapp.sent[0]!.body).toContain('est confirmé');
  });

  it('enregistre une demande de report pour « 2 » et redemande pour un texte inconnu', async () => {
    await runReminders().expect(201);
    whatsapp.sent.length = 0;
    const unknown = await inbound({ from: EN.phone, type: 'text', text: 'maybe' }).expect(200);
    expect(unknown.body).toEqual({ outcome: 'unknown_reply' });
    expect(whatsapp.sent[0]!.body).toContain('Reply 1 to confirm');
    const postponed = await inbound({ from: EN.phone, type: 'text', text: ' 2 ' }).expect(200);
    expect(postponed.body).toEqual({ outcome: 'postponement_requested' });
    expect(store.get('a-en')?.status).toBe('postponement_requested');
  });

  it('transmet la photo à la chaîne d’ingestion avec le canal WhatsApp et répond « Document reçu »', async () => {
    ingestOutcome = { status: 'duplicate' };
    const bytes = Buffer.from('photo-ordonnance');
    const res = await inbound({
      from: FR.phone,
      type: 'image',
      image: { fileName: 'ordonnance.jpg', base64: bytes.toString('base64') },
    }).expect(200);
    expect(res.body).toEqual({ outcome: 'document_ingested' });
    expect(ingested).toHaveLength(1);
    expect(ingested[0]!.channel).toBe('WhatsApp');
    expect(ingested[0]!.subject?.reference).toBe(`Patient/${FR.patientId}`);
    expect(Buffer.from(ingested[0]!.bytes).toString()).toBe('photo-ordonnance');
    expect(whatsapp.sent.at(-1)!.body).toBe('Document reçu');
  });

  it('signale à la cloche un document refusé par la chaîne', async () => {
    ingestOutcome = { status: 'failed', stage: 'reception', error: 'vide' };
    const res = await inbound({
      from: EN.phone,
      type: 'image',
      image: { base64: Buffer.from('x').toString('base64') },
    }).expect(200);
    expect(res.body).toEqual({ outcome: 'document_rejected' });
    expect(whatsapp.sent.at(-1)!.body).toContain('Document not processed');
  });

  it('refuse le webhook sans secret ou avec un message invalide', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/whatsapp')
      .send({ from: FR.phone, type: 'text', text: '1' })
      .expect(401);
    await inbound({ from: FR.phone, type: 'video' }).expect(400);
  });

  it('retient un message lié à une alerte critique jusqu’à sa validation par un soignant', async () => {
    role = 'medecin';
    const sent = await request(app.getHttpServer())
      .post('/messages')
      .set(auth)
      .send({ patientId: FR.patientId, text: 'Interaction à vérifier', alertId: 'alert-1' })
      .expect(201);
    expect(sent.body.status).toBe('blocked');
    expect(whatsapp.sent).toHaveLength(0);

    await event({
      type: 'alerte.notification',
      alertId: 'alert-other',
      patientId: FR.patientId,
      title: 't',
    }).expect(202);
    expect(whatsapp.sent).toHaveLength(0);

    await event({
      type: 'alerte.notification',
      alertId: 'alert-1',
      patientId: FR.patientId,
      title: 't',
    }).expect(202);
    expect(whatsapp.sent).toHaveLength(1);
    expect(whatsapp.sent[0]!.body).toBe('Message de votre médecin : Interaction à vérifier');
  });

  it('envoie tout de suite un message sans alerte, et refuse les non-soignants', async () => {
    role = 'medecin';
    const ok = await request(app.getHttpServer())
      .post('/messages')
      .set(auth)
      .send({ patientId: EN.patientId, text: 'See you soon' })
      .expect(201);
    expect(ok.body.status).toBe('sent');
    expect(whatsapp.sent[0]!.body).toBe('Message from your doctor: See you soon');
    role = 'patient';
    await request(app.getHttpServer())
      .post('/messages')
      .set(auth)
      .send({ patientId: EN.patientId, text: 'x' })
      .expect(403);
  });

  it('alimente la cloche selon le rôle (nouvelle alerte, fin d’analyse)', async () => {
    await event({ type: 'alerte.creee', alertId: 'a1', title: 'Interaction' }).expect(202);
    await event({ type: 'analyse.terminee', document: 'bilan.pdf' }).expect(202);
    role = 'medecin';
    const list = await request(app.getHttpServer()).get('/notifications').set(auth).expect(200);
    expect(list.body.map((n: { messageKey: string }) => n.messageKey)).toEqual([
      'notif.bell.analysisDone',
      'notif.bell.newAlert',
    ]);
    expect(list.body[1].params).toEqual({ title: 'Interaction' });
    role = 'auditeur';
    const none = await request(app.getHttpServer()).get('/notifications').set(auth).expect(200);
    expect(none.body).toEqual([]);
  });

  it('refuse les événements sans clé interne et le déclenchement des rappels par un patient', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({ type: 'analyse.terminee', document: 'x' })
      .expect(401);
    await event({ type: 'inconnu' }).expect(400);
    role = 'patient';
    await runReminders().expect(403);
  });
});

describe('configuration', () => {
  it('valide les variables d’environnement', () => {
    expect(loadEnv({}).port).toBe(3008);
    expect(() => loadEnv({ NOTIFICATION_PORT: 'abc' })).toThrow('NOTIFICATION_PORT invalide');
    expect(() => loadEnv({ IDENTITE_JWKS_URL: 'pas-une-url' })).toThrow(
      'IDENTITE_JWKS_URL invalide',
    );
    expect(() => loadEnv({ REMINDER_INTERVAL_MS: '-1' })).toThrow('REMINDER_INTERVAL_MS invalide');
  });
});
