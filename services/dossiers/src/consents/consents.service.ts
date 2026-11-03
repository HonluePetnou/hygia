import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import type { Language } from '@hygia/types';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import {
  REQUIRED_PURPOSE,
  type Consent,
  type ConsentPurpose,
  type ConsentSheet,
} from './consent.js';
import { CONSENT_REPOSITORY, allConsents, type ConsentRepository } from './consent-repository.js';

/**
 * Consentements des patients (RF21). Seul le patient lit et modifie les siens ; les autres
 * services interrogent `isGranted` (route interne) avant de produire une sortie IA, un rappel
 * WhatsApp, etc. Chaque lecture et chaque changement est audité.
 */
@Injectable()
export class ConsentsService {
  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly repository: ConsentRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Consentements et langue du patient connecté. */
  sheet(user: AuthenticatedUser, patientId: string): ConsentSheet {
    this.assertOwner(user, patientId);
    this.record(user, 'lecture', patientId, 'droit_acces');
    return {
      patientId,
      language: this.repository.languageOf(patientId),
      consents: allConsents(this.repository, patientId, this.clock.now()),
    };
  }

  /**
   * Accorde ou révoque une finalité. `expectedVersion` (facultatif) active le contrôle optimiste.
   *
   * @throws ConflictException si la version attendue n'est plus la courante.
   */
  update(
    user: AuthenticatedUser,
    patientId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    expectedVersion?: number,
  ): Consent {
    this.assertOwner(user, patientId);
    if (purpose === REQUIRED_PURPOSE && !granted) {
      throw new BadRequestException(
        'Le consentement aux soins est requis et ne peut pas être révoqué',
      );
    }
    const current = this.repository.get(patientId, purpose, this.clock.now());
    if (expectedVersion !== undefined && expectedVersion !== current.version) {
      throw new ConflictException(`Version périmée (courante : ${current.version})`);
    }
    if (current.granted === granted) return current;
    const at = this.clock.now().toISOString();
    const next: Consent = {
      id: current.id,
      version: current.version + 1,
      patientId,
      purpose,
      granted,
      ...(granted
        ? { grantedAt: at }
        : { ...(current.grantedAt ? { grantedAt: current.grantedAt } : {}), revokedAt: at }),
    };
    this.repository.save(next);
    this.record(
      user,
      'modification',
      patientId,
      `consentement_${purpose}_${granted ? 'accorde' : 'revoque'}`,
    );
    return next;
  }

  /** Enregistre la langue d'interface choisie par le patient. */
  setLanguage(user: AuthenticatedUser, patientId: string, language: Language): Language {
    this.assertOwner(user, patientId);
    this.repository.setLanguage(patientId, language);
    return language;
  }

  /** Vrai si le patient consent à la finalité (appel interne des autres services, sans utilisateur). */
  isGranted(patientId: string, purpose: ConsentPurpose): boolean {
    return this.repository.get(patientId, purpose, this.clock.now()).granted;
  }

  private assertOwner(user: AuthenticatedUser, patientId: string): void {
    if (user.role !== 'patient' || user.id !== patientId) {
      throw new ForbiddenException('Un patient ne gère que ses propres consentements');
    }
  }

  private record(
    user: AuthenticatedUser,
    action: 'lecture' | 'modification',
    patientId: string,
    reason: string,
  ): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action,
      resourceType: 'Consent',
      resourceId: patientId,
      patientId,
      reason,
    });
  }
}
