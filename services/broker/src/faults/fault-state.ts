import type { ServiceInstance, Zone } from '../config/env.js';

/** Pannes actuellement simulées (équivalent local d'AWS Fault Injection Service). */
export class FaultState {
  private readonly stopped = new Set<string>();
  private readonly cutZones = new Set<Zone>();
  private readonly latencies = new Map<string, number>();
  private llmDown = false;

  stopInstance(id: string, on: boolean): void {
    if (on) this.stopped.add(id);
    else this.stopped.delete(id);
  }

  cutZone(zone: Zone, on: boolean): void {
    if (on) this.cutZones.add(zone);
    else this.cutZones.delete(zone);
  }

  /** Latence ajoutée (ms) aux appels d'un service ; 0 la retire. */
  setLatency(service: string, ms: number): void {
    if (ms > 0) this.latencies.set(service, ms);
    else this.latencies.delete(service);
  }

  setLlmUnavailable(on: boolean): void {
    this.llmDown = on;
  }

  /** L'instance est-elle arrêtée, ou sa zone coupée ? */
  isDown(instance: ServiceInstance): boolean {
    return this.stopped.has(instance.id) || this.cutZones.has(instance.zone);
  }

  latencyFor(service: string): number {
    return this.latencies.get(service) ?? 0;
  }

  get llmUnavailable(): boolean {
    return this.llmDown;
  }
}
