import type { Patient } from '@hygia/types';
import type {
  AgentPrecisionData,
  AlertAgentId,
  AlertDecisionKind,
  AlertDetailData,
  AlertItem,
  AlertStatus,
  AlertTab,
} from './alert-types.js';
import { GatewayError } from './http-client.js';

const STATUS_OF: Record<AlertDecisionKind, AlertStatus> = {
  accepter: 'accepted',
  accepter_notifier: 'accepted_notified',
  rejeter: 'rejected',
};

const TAB_STATUSES: Record<AlertTab, readonly AlertStatus[]> = {
  ouvertes: ['pending'],
  acceptees: ['accepted', 'accepted_notified'],
  rejetees: ['rejected'],
};

const steps = (texts: string[]): AlertItem['reasoning'] => texts.map((text, index) => ({ step: index + 1, text }));

/** Alertes fictives de la démo hors ligne, toutes sur la première patiente du jeu de données. */
function seed(patientId: string): AlertItem[] {
  const base = { version: 1, patientId, decision: { status: 'pending' as const } };
  return [
    {
      ...base,
      id: '00000000-0000-4000-8000-0a0000000100',
      agent: 'pharmacovigilance',
      severity: 'high',
      title: 'Interaction majeure : warfarine × ibuprofène — risque hémorragique',
      reasoning: steps([
        'Nouvelle prescription reçue : ibuprofène 400 mg × 3/j, 5 jours.',
        'Traitement actif trouvé dans le dossier : warfarine 5 mg/j, INR cible 2–3.',
        'Règle d’interaction appliquée : AINS + antivitamine K, majoration du risque hémorragique.',
        'Contexte patient pris en compte : dernier INR à 2,8 : gravité relevée à « critique ».',
      ]),
      sources: [
        { document: { reference: 'DocumentReference/demo-1', display: 'Ordonnance WhatsApp · 28/10' }, excerpt: 'Ibuprofène 400 mg × 3/j' },
        { document: { reference: 'DocumentReference/demo-2', display: 'Bilan INR · 14/10' }, excerpt: 'INR 2,8' },
      ],
      proposal: 'Remplacer l’ibuprofène par du paracétamol, contrôler l’INR sous 72 h et prévenir le prescripteur.',
      raisedAt: '2026-11-02T10:26:00Z',
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0a0000000200',
      agent: 'pharmacovigilance',
      severity: 'high',
      title: 'Allergie connue à la pénicilline — amoxicilline prescrite',
      reasoning: steps(['Prescription d’amoxicilline reçue.', 'Allergie à la pénicilline documentée.']),
      sources: [{ document: { reference: 'DocumentReference/demo-3', display: 'Fiche allergies' }, excerpt: 'Pénicilline' }],
      proposal: 'Choisir une classe d’antibiotique alternative.',
      raisedAt: '2026-11-02T10:10:00Z',
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0a0000000300',
      agent: 'quality',
      severity: 'moderate',
      title: 'Créatininémie 1 450 µmol/L : valeur aberrante ?',
      reasoning: steps(['Valeur extraite du compte rendu de biologie.', 'Plus de dix fois la borne haute habituelle.']),
      sources: [{ document: { reference: 'DocumentReference/demo-4', display: 'Bilan biologique · 02/11' }, excerpt: 'Créatinine 1450 µmol/L' }],
      proposal: 'Vérifier la valeur sur le document d’origine.',
      raisedAt: '2026-11-02T09:26:00Z',
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0a0000000400',
      agent: 'pharmacovigilance',
      severity: 'moderate',
      title: 'Doublon thérapeutique : 2 IEC prescrits',
      reasoning: steps(['Deux IEC actifs dans le dossier.']),
      sources: [{ document: { reference: 'DocumentReference/demo-5', display: 'Ordonnance · 30/10' }, excerpt: 'Ramipril et périndopril' }],
      proposal: 'Conserver un seul IEC.',
      raisedAt: '2026-11-01T10:00:00Z',
    },
  ];
}

/** Alertes hors ligne (démo sans service) : mêmes règles que le service Dossiers. */
export class InMemoryAlerts {
  private readonly items: AlertItem[];

  constructor(
    patients: readonly Patient[],
    private readonly now: () => Date = () => new Date(),
  ) {
    this.items = seed(patients[0]?.id ?? '');
  }

  list(tab?: AlertTab): AlertItem[] {
    return this.items
      .filter((item) => tab === undefined || TAB_STATUSES[tab].includes(item.decision.status))
      .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt))
      .map((item) => structuredClone(item));
  }

  get(id: string): AlertDetailData {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new GatewayError(404, 'Alerte introuvable');
    return { ...structuredClone(item), precision: this.precisionOf(item.agent) };
  }

  decide(id: string, decision: AlertDecisionKind, justification?: string): AlertDetailData {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new GatewayError(404, 'Alerte introuvable');
    if (item.decision.status !== 'pending') throw new GatewayError(409, 'Alerte déjà traitée');
    if (decision === 'rejeter' && !justification?.trim()) {
      throw new GatewayError(400, 'justification obligatoire en cas de rejet');
    }
    item.decision = {
      status: STATUS_OF[decision],
      decidedBy: 'demo',
      decidedAt: this.now().toISOString(),
      ...(justification?.trim() ? { justification: justification.trim() } : {}),
    };
    item.version += 1;
    return this.get(id);
  }

  private precisionOf(agent: AlertAgentId): AgentPrecisionData {
    const decided = this.items.filter((item) => item.agent === agent && item.decision.status !== 'pending');
    const accepted = decided.filter((item) => item.decision.status !== 'rejected').length;
    return { agent, accepted, decided: decided.length, rate: decided.length === 0 ? null : accepted / decided.length };
  }
}
