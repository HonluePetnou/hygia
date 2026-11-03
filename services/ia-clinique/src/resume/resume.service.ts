import { Inject, Injectable } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import { createTranslator, type Translate } from '@hygia/i18n';
import type { Language } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import { CLINICAL_DIRECTORY, type ClinicalDirectory } from '../access/clinical-directory.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../copilote/copilote.service.js';
import { toSource, type CopiloteSource } from '../copilote/copilote.types.js';
import { PASSAGE_INDEX, type PassageIndex } from '../index/passage-index.js';

/** Ligne du résumé et les sources qui l'étayent. */
export interface ResumeItem {
  texte: string;
  sources: CopiloteSource[];
}

/** Résumé pré-consultation : généré par IA, à valider par un soignant (jamais écrit au dossier). */
export interface Resume {
  patientId: string;
  language: Language;
  generatedByAi: true;
  titres: { antecedents: string; traitements: string; resultats: string; alertes: string };
  antecedents: ResumeItem[];
  traitements: ResumeItem[];
  resultats: ResumeItem[];
  alertes: ResumeItem[];
}

const WARFARIN = 'B01AA03';
const IBUPROFEN = 'M01AE01';

/** Construit le résumé : une ligne n'est affichée que si au moins une source du dossier l'étaye. */
@Injectable()
export class ResumeService {
  constructor(
    @Inject(PASSAGE_INDEX) private readonly index: PassageIndex,
    @Inject(CLINICAL_DIRECTORY) private readonly directory: ClinicalDirectory,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly policy: AccessPolicy,
  ) {}

  summarize(user: AuthenticatedUser, patientId: string, language: Language): Resume {
    this.policy.require(user, patientId);
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'lecture',
      resourceType: 'Resume',
      resourceId: patientId,
      patientId,
      reason: 'soins',
    });
    const t = createTranslator(language);
    const record = this.directory.recordOf(patientId);
    const item = (texte: string, terms: string[]): ResumeItem[] => {
      const sources = this.sourcesFor(patientId, terms);
      return sources.length === 0 ? [] : [{ texte, sources }];
    };

    const antecedents = record.conditions.flatMap((c) =>
      item(t('summary.condition', { label: c.code.display, date: c.onsetDate }), [c.code.display]),
    );
    const traitements = record.medicationRequests.flatMap((m) =>
      item(
        t('summary.treatment', {
          label: m.medication.display,
          dose: m.dosage.doseValue,
          unit: m.dosage.doseUnit,
          times: m.dosage.timesPerDay,
          date: m.authoredOn,
        }),
        [m.medication.display],
      ),
    );
    const resultats = [...record.observations]
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
      .flatMap((o) =>
        item(
          t('summary.result', {
            label: o.code.display,
            value: o.value,
            unit: o.unit,
            date: o.effectiveDate,
          }),
          [o.code.display],
        ),
      );
    const alertes = [
      ...record.allergies.flatMap((a) =>
        item(
          t('summary.alert.allergy', { label: a.substance.display, criticality: a.criticality }),
          [a.substance.display],
        ),
      ),
      ...this.interactionAlert(record.medicationRequests, t, item),
    ];

    return {
      patientId,
      language,
      generatedByAi: true,
      titres: {
        antecedents: t('summary.history'),
        traitements: t('summary.treatments'),
        resultats: t('summary.results'),
        alertes: t('summary.alerts'),
      },
      antecedents,
      traitements,
      resultats,
      alertes,
    };
  }

  /** Alerte warfarine + ibuprofène (AINS), à décider par le soignant. */
  private interactionAlert(
    medications: { medication: { code: string; display: string } }[],
    t: Translate,
    item: (texte: string, terms: string[]) => ResumeItem[],
  ): ResumeItem[] {
    const find = (code: string) => medications.find((m) => m.medication.code === code)?.medication;
    const warfarin = find(WARFARIN);
    const ibuprofen = find(IBUPROFEN);
    if (!warfarin || !ibuprofen) return [];
    return item(
      t('summary.alert.interaction', { first: warfarin.display, second: ibuprofen.display }),
      [`${warfarin.display} ${ibuprofen.display}`],
    );
  }

  /** Meilleur passage pour chaque terme, sans doublon, numérotés à partir de 1. */
  private sourcesFor(patientId: string, terms: string[]): CopiloteSource[] {
    const seen = new Set<string>();
    const sources: CopiloteSource[] = [];
    for (const term of terms) {
      const best = this.index.search(patientId, term, 1)[0];
      if (!best || seen.has(best.id)) continue;
      seen.add(best.id);
      sources.push(toSource(sources.length + 1, best));
    }
    return sources;
  }
}
