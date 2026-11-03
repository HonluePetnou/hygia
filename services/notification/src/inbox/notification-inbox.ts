import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Role } from '@hygia/types';
import { Observable, Subject } from 'rxjs';

/** Types de notifications de la cloche (RF13). */
export type BellKind = 'analysis_done' | 'analysis_failed' | 'summary_ready' | 'new_alert';

/**
 * Notification de la cloche. Le texte n'est pas stocké : le client traduit `messageKey`
 * avec `@hygia/i18n` et `params` (aucun texte d'interface en dur côté service).
 */
export interface BellNotification {
  id: string;
  kind: BellKind;
  messageKey: string;
  params: Record<string, string>;
  /** Rôles destinataires. */
  roles: Role[];
  at: string;
}

/** Soignants destinataires par défaut des notifications cliniques. */
export const CLINICAL_ROLES: Role[] = ['medecin', 'infirmier'];

/** Boîte de notifications en mémoire avec diffusion en temps réel (SSE). */
@Injectable()
export class NotificationInbox {
  private readonly items: BellNotification[] = [];
  private readonly live = new Subject<BellNotification>();

  /** Ajoute une notification et la diffuse aux abonnés. */
  push(
    kind: BellKind,
    messageKey: string,
    params: Record<string, string>,
    at: string,
    roles: Role[] = CLINICAL_ROLES,
  ): BellNotification {
    const notification: BellNotification = { id: randomUUID(), kind, messageKey, params, roles, at };
    this.items.push(notification);
    this.live.next(notification);
    return notification;
  }

  /** Notifications visibles pour un rôle, les plus récentes d'abord. */
  list(role: Role): BellNotification[] {
    return this.items.filter((n) => n.roles.includes(role)).reverse();
  }

  /** Flux des nouvelles notifications visibles pour un rôle. */
  stream(role: Role): Observable<BellNotification> {
    return new Observable<BellNotification>((subscriber) => {
      const subscription = this.live.subscribe((n) => {
        if (n.roles.includes(role)) subscriber.next(n);
      });
      return () => subscription.unsubscribe();
    });
  }
}
