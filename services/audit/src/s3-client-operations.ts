import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { S3ObjectLockOperations } from './s3-audit-store.js';

/** Adresse S3 : LocalStack (`endpoint` + identifiants de test) ou AWS (chaîne d'identifiants standard). */
export interface S3Target {
  bucket: string;
  region: string;
  endpoint?: string;
}

export function s3Client(target: S3Target): S3Client {
  return new S3Client({
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

/** `S3ObjectLockOperations` sur le SDK AWS : chaque entrée est un objet verrouillé (WORM). */
export class S3ClientObjectLockOperations implements S3ObjectLockOperations {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async putLocked(key: string, body: string, retainUntil: Date): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        ObjectLockMode: 'COMPLIANCE',
        ObjectLockRetainUntilDate: retainUntil,
      }),
    );
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys.sort();
  }

  async getObject(key: string): Promise<string> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return (await object.Body?.transformToString('utf-8')) ?? '';
  }
}
