import type { Incident, IncidentStatus } from '@slink/shared';

export class IncidentStore {
  private incidents: Map<string, Incident> = new Map();
  // Index by fingerprint -> incident ID for fast deduplication lookup
  private fingerprintIndex: Map<string, string> = new Map();

  public getById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public getByFingerprint(fingerprint: string): Incident | undefined {
    const id = this.fingerprintIndex.get(fingerprint);
    if (!id) return undefined;
    return this.incidents.get(id);
  }

  public list(filter?: { projectId?: string; status?: IncidentStatus }): Incident[] {
    let all = Array.from(this.incidents.values());

    if (filter?.projectId) {
      all = all.filter((inc) => inc.projectId === filter.projectId);
    }
    if (filter?.status) {
      all = all.filter((inc) => inc.status === filter.status);
    }

    return all.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  public save(incident: Incident): void {
    this.incidents.set(incident.id, incident);
    this.fingerprintIndex.set(incident.fingerprint, incident.id);
  }

  public clear(): void {
    this.incidents.clear();
    this.fingerprintIndex.clear();
  }
}

export const globalIncidentStore = new IncidentStore();
