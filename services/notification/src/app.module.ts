import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { remoteVerifier } from '@hygia/auth';
import { IngestionService } from '@hygia/ingestion';
import { createObservability } from '@hygia/observability';
import { ENV } from './auth/secret.js';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { ChannelRegistry } from './channels/channel-registry.js';
import { CHANNEL_SENDERS } from './channels/channel-sender.js';
import { ConsoleSender } from './channels/console-sender.js';
import { EmailSender, InMemoryEmailTransport } from './channels/email-sender.js';
import { InMemorySnsPublisher, SmsSender } from './channels/sms-sender.js';
import { SandboxWhatsAppApi, WhatsAppSender } from './channels/whatsapp-sender.js';
import { CONSENT_GATE, HttpConsentGate } from './consent/consent-gate.js';
import { loadEnv } from './config/env.js';
import { CriticalMessageService } from './critical/critical-message.service.js';
import { MessagesController } from './critical/messages.controller.js';
import { DEMO_RECIPIENTS, demoAppointments } from './demo-data.js';
import { EventsController } from './events/events.controller.js';
import { EventsService } from './events/events.service.js';
import { NotificationInbox } from './inbox/notification-inbox.js';
import { NotificationsController } from './inbox/notifications.controller.js';
import {
  APPOINTMENT_STORE,
  InMemoryAppointmentStore,
  InMemoryRecipientDirectory,
  RECIPIENT_DIRECTORY,
} from './reminders/appointments.js';
import { AppointmentsController } from './reminders/appointments.controller.js';
import { ReminderService, CLOCK } from './reminders/reminder.service.js';
import { ReminderTimer } from './reminders/reminder-timer.js';
import { RemindersController } from './reminders/reminders.controller.js';
import { ReplyService } from './reminders/reply.service.js';
import { MessageTemplates } from './templates/message-templates.js';
import { WhatsAppController } from './whatsapp/whatsapp.controller.js';
import { DOCUMENT_INGESTOR, WhatsAppWebhookService } from './whatsapp/whatsapp-webhook.service.js';

/**
 * Module racine. Canaux en mémoire / bac à sable (WhatsApp Business, SNS LocalStack, SES en
 * production) et canal console pour la démo.
 */
@Module({
  controllers: [
    WhatsAppController,
    EventsController,
    NotificationsController,
    MessagesController,
    RemindersController,
    AppointmentsController,
  ],
  providers: [
    JwtAuthGuard,
    ChannelRegistry,
    MessageTemplates,
    NotificationInbox,
    ReminderService,
    ReminderTimer,
    ReplyService,
    CriticalMessageService,
    EventsService,
    WhatsAppWebhookService,
    {
      provide: CONSENT_GATE,
      useFactory: () => new HttpConsentGate(loadEnv().dossiersUrl, loadEnv().dossiersInternalKey),
    },
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
    { provide: CLOCK, useValue: () => new Date() },
    { provide: DOCUMENT_INGESTOR, useFactory: () => new IngestionService() },
    {
      provide: RECIPIENT_DIRECTORY,
      useFactory: () => new InMemoryRecipientDirectory(DEMO_RECIPIENTS),
    },
    {
      provide: APPOINTMENT_STORE,
      useFactory: () => new InMemoryAppointmentStore(demoAppointments(new Date())),
    },
    {
      provide: CHANNEL_SENDERS,
      useFactory: () => [
        new WhatsAppSender(new SandboxWhatsAppApi()),
        new SmsSender(new InMemorySnsPublisher()),
        new EmailSender(new InMemoryEmailTransport()),
        new ConsoleSender(),
      ],
    },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id`. */
  configure(consumer: MiddlewareConsumer): void {
    const quiet = process.env['NODE_ENV'] === 'test';
    const { middleware } = createObservability({
      service: 'notification',
      ...(quiet ? { log: () => undefined } : {}),
    });
    consumer.apply(middleware).forRoutes('*path');
  }
}
