import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { Env } from '../config/env.js';
import { ENV } from '../auth/secret.js';
import { ReminderService } from './reminder.service.js';

/** Planificateur périodique des rappels (désactivé si `REMINDER_INTERVAL_MS` vaut 0). */
@Injectable()
export class ReminderTimer implements OnApplicationBootstrap, OnApplicationShutdown {
  private handle: NodeJS.Timeout | undefined;

  constructor(
    private readonly reminders: ReminderService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.reminderIntervalMs <= 0) return;
    this.handle = setInterval(() => void this.reminders.runDue(), this.env.reminderIntervalMs);
    this.handle.unref();
  }

  onApplicationShutdown(): void {
    if (this.handle !== undefined) clearInterval(this.handle);
  }
}
