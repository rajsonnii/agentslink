import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Incident } from '@slink/shared';
import { IncidentStore } from '../incident-store.js';

test('IncidentStore: saves incidents, syncs to disk, and rehydrates on restart', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-store-test-'));

  try {
    const store1 = new IncidentStore(tmpDir);

    const sampleIncident: Incident = {
      id: 'inc_persist_01',
      projectId: 'prod-api',
      title: 'Crash: Out of memory',
      fingerprint: 'fp_oom_1234',
      status: 'OPEN',
      severity: 'CRITICAL',
      triggerType: 'PROCESS_CRASH',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      occurrenceCount: 3,
      errorSummary: 'Killed',
      relatedLogs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store1.save(sampleIncident);
    store1.flushToDisk();

    // Now simulate container restart with fresh store pointing to same data directory
    const store2 = new IncidentStore(tmpDir);
    const recovered = store2.getById('inc_persist_01');
    assert.ok(recovered);
    assert.equal(recovered.title, 'Crash: Out of memory');
    assert.equal(recovered.occurrenceCount, 3);

    // Fast fingerprint lookup index should also be intact
    const byFingerprint = store2.getByFingerprint('fp_oom_1234');
    assert.ok(byFingerprint);
    assert.equal(byFingerprint.id, 'inc_persist_01');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
