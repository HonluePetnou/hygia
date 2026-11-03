import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import { createTranslator } from '@hygia/i18n';
import { AccessPolicy } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CONSENT_GATE, type ConsentGate } from '../consent/consent-gate.js';
import { PASSAGE_INDEX, type Passage, type PassageIndex } from '../index/passage-index.js';
import { detectLanguage } from '../index/text.js';
import {
  CLINICAL_LANGUAGE_MODEL,
  type ClinicalLanguageModel,
} from '../model/clinical-language-model.js';
import { toSource, type CopiloteAnswer, type CopiloteSource } from './copilote.types.js';

/** Jeton d'injection du journal d'audit. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Nombre maximal de passages fournis au modèle. */
const MAX_PASSAGES = 3;

/**
 * Copilote sourcé (RF7) : il ne répond qu'à partir des passages retrouvés dans le dossier du
 * patient, cite chaque source et déclare ne pas savoir quand il n'en trouve aucune. Il répond dans
 * la langue de la question (RF28) et ne modifie jamais le dossier.
 */
@Injectable()
export class CopiloteService {
  constructor(
    @Inject(PASSAGE_INDEX) private readonly index: PassageIndex,
    @Inject(CLINICAL_LANGUAGE_MODEL) private readonly model: ClinicalLanguageModel,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CONSENT_GATE) private readonly consent: ConsentGate,
    private readonly policy: AccessPolicy,
  ) {}

  /** Répond à une question sur le dossier ; la question est auditée (RF24). */
  async ask(
    user: AuthenticatedUser,
    patientId: string,
    question: string,
    options: { modelUnavailable?: boolean } = {},
  ): Promise<CopiloteAnswer> {
    this.policy.require(user, patientId);
    // Consentement IA révoqué par le patient : aucune question, aucun passage retrouvé.
    if (!(await this.consent.allows(patientId, 'ia'))) {
      throw new ForbiddenException('Le patient a refusé l’usage de l’IA sur son dossier');
    }
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'question_copilote',
      resourceType: 'Patient',
      resourceId: patientId,
      patientId,
      reason: 'soins',
    });
    const language = detectLanguage(question);
    const passages = this.index.search(patientId, question, MAX_PASSAGES);
    if (passages.length === 0) return this.unanswered(language);

    // Panne simulée (broker) ou réelle du modèle : recherche simple, jamais une erreur.
    if (options.modelUnavailable === true) return degradedAnswer(passages, language);
    let answer: string;
    try {
      answer = await this.model.generate({ question, passages, language });
    } catch {
      return degradedAnswer(passages, language);
    }
    const sources = citedSources(answer, passages);
    // Une réponse sans aucune source valide n'est jamais renvoyée.
    return sources.length === 0 ? this.unanswered(language) : { answer, language, sources };
  }

  private unanswered(language: 'fr' | 'en'): CopiloteAnswer {
    return { answer: createTranslator(language)('copilot.noSourceAnswer'), language, sources: [] };
  }
}

/**
 * Mode dégradé : sans modèle, le copilote renvoie les passages trouvés tels quels, numérotés
 * et cités ; rien n'est généré, donc rien n'est inventé.
 */
function degradedAnswer(passages: readonly Passage[], language: 'fr' | 'en'): CopiloteAnswer {
  const sources = passages.map((passage, position) => toSource(position + 1, passage));
  const lines = sources.map((source) => `[${source.n}] ${source.extrait}`);
  const answer = [createTranslator(language)('copilot.degradedMode'), ...lines].join('\n');
  return { answer, language, sources, degraded: true };
}

/** Sources dont le marqueur `[n]` apparaît réellement dans la réponse, dans l'ordre des numéros. */
function citedSources(answer: string, passages: readonly Passage[]): CopiloteSource[] {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) cited.add(Number(match[1]));
  return passages.flatMap((passage, position) =>
    cited.has(position + 1) ? [toSource(position + 1, passage)] : [],
  );
}
