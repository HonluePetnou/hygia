import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import type { ResourceStore, StoredResource } from './resource-store.js';

/** Ressources de Dossiers dans PostgreSQL (table `fhir_resource`, JSONB), via Prisma. */
export class PrismaResourceStore implements ResourceStore {
  private readonly prisma: PrismaClient;

  constructor(connectionString: string) {
    this.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async loadAll(): Promise<StoredResource[]> {
    const rows = await this.prisma.fhirResource.findMany({
      orderBy: [{ resourceType: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      resourceType: row.resourceType,
      id: row.id,
      patientId: row.patientId,
      version: row.version,
      body: row.body,
    }));
  }

  async upsert(rows: readonly StoredResource[]): Promise<void> {
    // Une transaction : toutes les ressources d'une modification (consultation, fusion) ou aucune.
    await this.prisma.$transaction(
      rows.map((row) => {
        const data = {
          patientId: row.patientId,
          version: row.version,
          body: row.body as Prisma.InputJsonValue,
        };
        return this.prisma.fhirResource.upsert({
          where: { resourceType_id: { resourceType: row.resourceType, id: row.id } },
          create: { resourceType: row.resourceType, id: row.id, ...data },
          update: data,
        });
      }),
    );
  }

  close(): Promise<void> {
    return this.prisma.$disconnect();
  }
}
