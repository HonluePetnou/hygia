import { SERVICE_NAMES, parseInstances, type ServiceInstance } from '../config/env.js';

/** Registre de services par nom : transparence de localisation (section 7.2), plusieurs instances par service. */
export class ServiceRegistry {
  private readonly byService = new Map<string, ServiceInstance[]>();

  constructor(services: Record<string, string>) {
    for (const [name, raw] of Object.entries(services)) this.byService.set(name, parseInstances(name, raw));
  }

  /** Instances déclarées du service ; vide s'il est inconnu ou non déclaré. */
  instances(name: string): ServiceInstance[] {
    if (!(SERVICE_NAMES as readonly string[]).includes(name)) return [];
    return this.byService.get(name) ?? [];
  }
}
