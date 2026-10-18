import fs from 'node:fs';
import path from 'node:path';
import type { Incident, IncidentStatus } from '@slink/shared';

export class IncidentStore {
  private incidents: Map<string, Incident> = new Map();
  // Index by fingerprint -> incident ID for fast O(1) deduplication lookup
  private fingerprintIndex: Map<string, string> = new Map();
  private dataFilePath: string | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(persistDir?: string) {
    const targetDir = persistDir || process.env['SLINK_DATA_DIR'];
    if (targetDir) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        this.dataFilePath = path.join(targetDir, 'incidents.json');
        this.loadFromDisk();
      } catch (err) {
        console.warn('[slink-api] Could not initialize disk persistence:', err);
      }
    }
  }

  private loadFromDisk(): void {
    if (!this.dataFilePath || !fs.existsSync(this.dataFilePath)) return;

    try {
      const raw = fs.readFileSync(this.dataFilePath, 'utf8');
      const data = JSON.parse(raw) as Incident[];
      for (const inc of data) {
        this.incidents.set(inc.id, inc);
        this.fingerprintIndex.set(inc.fingerprint, inc.id);
      }
      console.log(`[slink-api] Rehydrated ${data.length} incidents from persistent storage.`);
    } catch (err) {
      console.warn('[slink-api] Failed to read persisted incidents:', err);
    }
  }

  private scheduleDiskSync(): void {
    if (!this.dataFilePath) return;

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.flushToDisk();
    }, 500);
  }

  public flushToDisk(): void {
    if (!this.dataFilePath) return;
    const dir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dir)) return;

    try {
      const data = Array.from(this.incidents.values());
      const tempFile = `${this.dataFilePath}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempFile, this.dataFilePath);
    } catch (err) {
      console.warn('[slink-api] Failed to persist incidents to disk:', err);
    }
  }

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
    this.scheduleDiskSync();
  }

  public clear(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.incidents.clear();
    this.fingerprintIndex.clear();
    if (this.dataFilePath && fs.existsSync(this.dataFilePath)) {
      try {
        fs.unlinkSync(this.dataFilePath);
      } catch {}
    }
  }
}

export const globalIncidentStore = new IncidentStore();
