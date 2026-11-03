import { ALERT_AGENTS, type AgentPrecision, type AlertRecord } from './alert.js';

/** Fenêtre de mesure de la précision (jours). */
export const PRECISION_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Précision de chaque agent : alertes acceptées / alertes décidées (acceptées ou rejetées)
 * dans les 30 derniers jours. Les alertes encore ouvertes ne comptent pas.
 */
export function computePrecision(alerts: readonly AlertRecord[], now: Date): AgentPrecision[] {
  const since = now.getTime() - PRECISION_WINDOW_DAYS * DAY_MS;
  return ALERT_AGENTS.map((agent) => {
    const decided = alerts.filter((alert) => {
      const at = alert.decision.decidedAt === undefined ? Number.NaN : Date.parse(alert.decision.decidedAt);
      return alert.agent === agent && alert.decision.status !== 'pending' && at >= since && at <= now.getTime();
    });
    const accepted = decided.filter((alert) => alert.decision.status !== 'rejected').length;
    return { agent, accepted, decided: decided.length, rate: decided.length === 0 ? null : accepted / decided.length };
  });
}
