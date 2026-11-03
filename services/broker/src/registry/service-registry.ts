import { SERVICE_NAMES } from '../config/env.js';

/** Registre de services par nom : transparence de localisation (section 7.2). */
export class ServiceRegistry {
  private readonly urls: Map<string, string>;

  constructor(services: Record<string, string>) {
    this.urls = new Map(Object.entries(services));
  }

  /** Adresse de base du service, ou `undefined` s'il est inconnu ou non déclaré. */
  resolve(name: string): URL | undefined {
    if (!(SERVICE_NAMES as readonly string[]).includes(name)) return undefined;
    const url = this.urls.get(name);
    return url === undefined ? undefined : new URL(url);
  }
}
