import { newestFirst, type DocumentStore } from './document-store.js';
import type { NewResourceVersion, ResourceVersion } from './resource-version.js';

/** Copie profonde figée : une version enregistrée ne peut plus être modifiée. */
function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Stockage des versions en mémoire (tests, démo). */
export class InMemoryDocumentStore implements DocumentStore {
  private readonly byResource = new Map<string, ResourceVersion[]>();

  async append(version: NewResourceVersion): Promise<ResourceVersion> {
    const existing = this.byResource.get(version.resourceId) ?? [];
    if (existing.some((entry) => entry.number === version.number)) {
      throw new Error(`Version ${version.number} déjà enregistrée pour ${version.resourceId}`);
    }
    const stored = freeze(structuredClone(version)) as ResourceVersion;
    this.byResource.set(
      version.resourceId,
      [...existing, stored].sort((a, b) => a.number - b.number),
    );
    return stored;
  }

  async list(resourceId: string): Promise<ResourceVersion[]> {
    return [...(this.byResource.get(resourceId) ?? [])];
  }

  async get(resourceId: string, number: number): Promise<ResourceVersion | undefined> {
    return this.byResource.get(resourceId)?.find((entry) => entry.number === number);
  }

  async listForPatient(patientId: string): Promise<ResourceVersion[]> {
    return [...this.byResource.values()]
      .flat()
      .filter((entry) => entry.patientId === patientId)
      .sort(newestFirst);
  }
}
