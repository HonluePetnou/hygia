import { FLORENCE_ID } from '@hygia/fhir';
import type { AuditGateway } from './audit-gateway.js';
import type {
  AuditActionName,
  AuditEventData,
  AuditFilter,
  AuditPageData,
  AuditSearch,
  AuditSummaryData,
} from './audit-types.js';

const ACTIONS_OF: Record<AuditFilter, readonly AuditActionName[] | undefined> = {
  tous: undefined,
  lectures: ['lecture'],
  modifications: ['modification', 'creation', 'import_document'],
  bris_de_glace: ['bris_de_glace'],
  copilote: ['question_copilote', 'alerte_ia'],
  exports: ['export'],
};

type Seed = Pick<AuditEventData, 'actor' | 'role' | 'action' | 'resourceType' | 'resourceId' | 'reason'>;

const SEEDS: readonly Seed[] = [
  { actor: 'Dr A. Nana', role: 'medecin', action: 'lecture', resourceType: 'Patient', resourceId: 'F. Ngo Bassa', reason: 'Soins · équipe' },
  { actor: 'Dr A. Nana', role: 'medecin', action: 'question_copilote', resourceType: 'Patient', resourceId: 'F. Ngo Bassa', reason: 'Soins · équipe' },
  { actor: 'Agent pharmacovigilance', role: 'admin', action: 'alerte_ia', resourceType: 'MedicationRequest', resourceId: '#9921', reason: 'Surveillance' },
  { actor: 'Dr B. Ondoa', role: 'medecin', action: 'bris_de_glace', resourceType: 'Patient', resourceId: 'S. Etoundi', reason: 'Urgence vitale — patient inconscient' },
  { actor: 'G. Ewane', role: 'admin', action: 'import_document', resourceType: 'DocumentReference', resourceId: '#5512', reason: 'Ingestion' },
  { actor: 'R. Mballa', role: 'infirmier', action: 'modification', resourceType: 'Observation', resourceId: 'TA · K. Abena', reason: 'Soins · équipe' },
  { actor: 'Florence Ngo Bassa', role: 'patient', action: 'lecture', resourceType: 'Journal', resourceId: 'Journal de son dossier', reason: 'Droit d’accès' },
];

const hashOf = (n: number) => `${(n * 2654435761).toString(16).padStart(8, '0')}${'0'.repeat(56)}`.slice(0, 64);

/** Entrées fictives du jour (une toutes les 17 minutes, la plus ancienne en premier). */
export function demoAuditEvents(day = '2026-10-28'): AuditEventData[] {
  return SEEDS.map((seed, index) => {
    const minutes = 8 * 60 + index * 17;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return {
      ...seed,
      index,
      lamport: 48190 + index,
      timestamp: `${day}T${hh}:${mm}:07.000Z`,
      patientId: FLORENCE_ID,
      previousHash: index === 0 ? '' : hashOf(index - 1),
      hash: hashOf(index),
    };
  });
}

/** Journal en mémoire pour la démonstration hors ligne et les tests. */
export class InMemoryAuditGateway implements AuditGateway {
  private readonly events: AuditEventData[];

  constructor(
    events: readonly AuditEventData[] = demoAuditEvents(),
    private readonly now: () => Date = () => new Date('2026-10-28T12:00:00Z'),
    private readonly intact = true,
  ) {
    this.events = [...events];
  }

  private matching(search: Omit<AuditSearch, 'page' | 'pageSize'>): AuditEventData[] {
    const actions = ACTIONS_OF[search.filter];
    const needle = search.text.trim().toLowerCase();
    return this.events
      .filter(
        (e) =>
          (actions === undefined || actions.includes(e.action)) &&
          (needle === '' ||
            [e.actor, e.resourceType, e.resourceId, e.patientId, e.reason].some((f) =>
              f.toLowerCase().includes(needle),
            )),
      )
      .sort((a, b) => b.index - a.index);
  }

  search(search: AuditSearch): Promise<AuditPageData> {
    const rows = this.matching(search);
    const start = (search.page - 1) * search.pageSize;
    return Promise.resolve({
      items: rows.slice(start, start + search.pageSize),
      total: rows.length,
      page: search.page,
      pageSize: search.pageSize,
    });
  }

  summary(): Promise<AuditSummaryData> {
    const day = this.now().toISOString().slice(0, 10);
    const today = this.events.filter((e) => e.timestamp.startsWith(day));
    return Promise.resolve({
      eventsToday: today.length,
      breakGlassToday: today.filter((e) => e.action === 'bris_de_glace').length,
      chainBreaks: this.intact ? 0 : 1,
      chainIntact: this.intact,
      ...(this.intact ? {} : { brokenAt: 1 }),
      verifiedAt: `${day}T03:00:00.000Z`,
      total: this.events.length,
      lastEntries: this.events.slice(-3),
    });
  }

  exportCsv(search: Omit<AuditSearch, 'page' | 'pageSize'>): Promise<string> {
    const lines = this.matching(search).map(
      (e) => [e.lamport, e.timestamp, e.actor, e.action, e.resourceId, e.reason, e.hash].join(','),
    );
    return Promise.resolve(['lamport,timestamp,actor,action,resourceId,reason,hash', ...lines].join('\r\n'));
  }
}
