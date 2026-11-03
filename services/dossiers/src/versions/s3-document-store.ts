import { newestFirst, type DocumentStore } from './document-store.js';
import type { NewResourceVersion, ResourceVersion } from './resource-version.js';

/** Version d'un objet S3, telle que renvoyée par `ListObjectVersions`. */
export interface S3ObjectVersion {
  versionId: string;
}

/**
 * Sous-ensemble des opérations S3 utilisées. Un petit adaptateur au-dessus de `@aws-sdk/client-s3`
 * (endpoint LocalStack en local) l'implémente ; le bucket doit avoir le versionnement activé.
 */
export interface S3Operations {
  /** `PutObject` : crée une nouvelle version de l'objet. */
  putObject(key: string, body: string, metadata: Record<string, string>): Promise<void>;
  /** `ListObjectVersions` sur un préfixe, de la plus ancienne à la plus récente version. */
  listVersions(prefix: string): Promise<{ key: string; version: S3ObjectVersion }[]>;
  /** `GetObject` avec `VersionId`. */
  getObject(key: string, versionId: string): Promise<string>;
}

const PREFIX = 'resources/';

/**
 * Stockage sur S3 versionné : un objet par ressource (`resources/<id>.json`) dont chaque
 * modification est une version d'objet S3, donc immuable. Non utilisé par les tests (LocalStack
 * requis) ; `listForPatient` parcourt le préfixe et filtre, ce qui suffit pour la démonstration.
 */
export class S3DocumentStore implements DocumentStore {
  constructor(private readonly s3: S3Operations) {}

  async append(version: NewResourceVersion): Promise<ResourceVersion> {
    const existing = await this.list(version.resourceId);
    if (existing.some((entry) => entry.number === version.number)) {
      throw new Error(`Version ${version.number} déjà enregistrée pour ${version.resourceId}`);
    }
    await this.s3.putObject(`${PREFIX}${version.resourceId}.json`, JSON.stringify(version), {
      'resource-type': version.resourceType,
      'patient-id': version.patientId,
    });
    return version;
  }

  async list(resourceId: string): Promise<ResourceVersion[]> {
    const key = `${PREFIX}${resourceId}.json`;
    const found = (await this.s3.listVersions(key)).filter((entry) => entry.key === key);
    const versions = await Promise.all(found.map((entry) => this.read(entry)));
    return versions.sort((a, b) => a.number - b.number);
  }

  async get(resourceId: string, number: number): Promise<ResourceVersion | undefined> {
    return (await this.list(resourceId)).find((entry) => entry.number === number);
  }

  async listForPatient(patientId: string): Promise<ResourceVersion[]> {
    const found = await this.s3.listVersions(PREFIX);
    const versions = await Promise.all(found.map((entry) => this.read(entry)));
    return versions.filter((entry) => entry.patientId === patientId).sort(newestFirst);
  }

  private async read(entry: { key: string; version: S3ObjectVersion }): Promise<ResourceVersion> {
    return JSON.parse(await this.s3.getObject(entry.key, entry.version.versionId)) as ResourceVersion;
  }
}
