import type { Pipe } from './filter.js';

/** Sous-ensemble du client SQS utilisé (adaptable depuis `@aws-sdk/client-sqs`). */
export interface SqsClientLike {
  sendMessage(queueUrl: string, body: string): Promise<void>;
  receiveMessage(queueUrl: string): Promise<string | undefined>;
}

/**
 * Tube adossé à SQS (LocalStack en local, via `AWS_ENDPOINT_URL`). Optionnel : non utilisé
 * par les tests ; le client est injecté pour ne pas imposer le SDK AWS.
 */
export class SqsPipe<T> implements Pipe<T> {
  constructor(
    private readonly client: SqsClientLike,
    private readonly queueUrl: string,
  ) {}

  /** URL de file par défaut sous LocalStack (`AWS_ENDPOINT_URL`). */
  static localQueueUrl(name: string, env: NodeJS.ProcessEnv = process.env): string {
    const endpoint = env['AWS_ENDPOINT_URL'] ?? 'http://localhost:4566';
    return `${endpoint}/000000000000/${name}`;
  }

  async send(message: T): Promise<void> {
    await this.client.sendMessage(this.queueUrl, JSON.stringify(message));
  }

  async receive(): Promise<T | undefined> {
    const body = await this.client.receiveMessage(this.queueUrl);
    return body === undefined ? undefined : (JSON.parse(body) as T);
  }
}
