import {
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { S3ObjectVersion, S3Operations } from './s3-document-store.js';

/** Adresse S3 : LocalStack (`endpoint` + identifiants de test) ou AWS (chaîne d'identifiants standard). */
export interface S3Target {
  bucket: string;
  region: string;
  endpoint?: string;
}

/** `S3Operations` sur le SDK AWS (bucket versionné : chaque `PutObject` crée une version). */
export class S3ClientOperations implements S3Operations {
  private readonly client: S3Client;

  constructor(private readonly target: S3Target) {
    this.client = new S3Client({
      region: target.region,
      ...(target.endpoint
        ? {
            endpoint: target.endpoint,
            forcePathStyle: true,
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          }
        : {}),
    });
  }

  async putObject(key: string, body: string, metadata: Record<string, string>): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.target.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/fhir+json',
        Metadata: metadata,
      }),
    );
  }

  async listVersions(prefix: string): Promise<{ key: string; version: S3ObjectVersion }[]> {
    const found: { key: string; version: S3ObjectVersion; at: number }[] = [];
    let keyMarker: string | undefined;
    let versionMarker: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectVersionsCommand({
          Bucket: this.target.bucket,
          Prefix: prefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionMarker,
        }),
      );
      for (const v of page.Versions ?? []) {
        if (v.Key && v.VersionId) {
          found.push({ key: v.Key, version: { versionId: v.VersionId }, at: v.LastModified?.getTime() ?? 0 });
        }
      }
      keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      versionMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
    } while (keyMarker);
    // De la plus ancienne à la plus récente (contrat de S3Operations).
    return found.sort((a, b) => a.at - b.at).map(({ key, version }) => ({ key, version }));
  }

  async getObject(key: string, versionId: string): Promise<string> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.target.bucket, Key: key, VersionId: versionId }),
    );
    return (await object.Body?.transformToString('utf-8')) ?? '';
  }
}
