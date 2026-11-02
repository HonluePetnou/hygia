/** Résultat de validation d'une ressource. */
export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Champs obligatoires (hors `resourceType`, `id`, `version`) par type de ressource. */
export const REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Patient: ['ipp', 'familyName', 'givenName', 'gender', 'birthDate', 'managingOrganization'],
  Practitioner: ['name', 'role', 'specialty', 'organization'],
  Organization: ['name', 'city'],
  CareTeam: ['name', 'participants', 'managingOrganization'],
  Encounter: ['subject', 'practitioner', 'encounterClass', 'start'],
  DocumentReference: ['subject', 'documentType', 'title', 'language', 'date', 'processingStatus'],
  Observation: ['subject', 'code', 'value', 'unit', 'effectiveDate'],
  Condition: ['subject', 'code', 'onsetDate'],
  MedicationRequest: ['subject', 'requester', 'medication', 'dosage', 'authoredOn'],
  AllergyIntolerance: ['subject', 'substance', 'criticality'],
  DetectedIssue: ['subject', 'agent', 'severity', 'explanation', 'sources', 'decision'],
  AuditEvent: [
    'actor',
    'action',
    'resource',
    'reason',
    'recordedAt',
    'lamport',
    'previousHash',
    'hash',
  ],
};

function checkBase(record: Record<string, unknown>, errors: string[]): void {
  const { id, version } = record;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    errors.push('id doit être un UUID');
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    errors.push('version doit être un entier >= 1');
  }
}

function checkLanguage(record: Record<string, unknown>, errors: string[]): void {
  if (record['resourceType'] === 'DocumentReference') {
    const { language } = record;
    if (language !== undefined && language !== 'fr' && language !== 'en') {
      errors.push('language doit valoir fr ou en');
    }
  }
}

/**
 * Valide minimalement une ressource : `resourceType` connu, `id` UUID, `version` entière et
 * champs obligatoires du type présents.
 *
 * @param resource Valeur à valider (de n'importe quel type).
 * @returns `{ ok: true }` ou `{ ok: false, errors }` avec la liste des problèmes.
 */
export function validateResource(resource: unknown): ValidationResult {
  if (typeof resource !== 'object' || resource === null || Array.isArray(resource)) {
    return { ok: false, errors: ['la ressource doit être un objet'] };
  }
  const record = resource as Record<string, unknown>;
  const type = record['resourceType'];
  const required = typeof type === 'string' ? REQUIRED_FIELDS[type] : undefined;
  if (required === undefined) {
    return { ok: false, errors: ['resourceType inconnu ou absent'] };
  }
  const errors: string[] = [];
  checkBase(record, errors);
  for (const field of required) {
    const value = record[field];
    // previousHash vaut '' pour le premier événement de la chaîne d'audit.
    const emptyAllowed = field === 'previousHash';
    if (value === undefined || value === null || (value === '' && !emptyAllowed)) {
      errors.push(`champ obligatoire manquant : ${field}`);
    }
  }
  checkLanguage(record, errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
