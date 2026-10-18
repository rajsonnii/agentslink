import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Incident } from '@slink/shared';
import { RepairOrchestrator } from '../orchestrator/repair-orchestrator.js';

test('RepairOrchestrator: fixes bug, verifies in sandbox, and generates PR when tests pass', async () => {
  const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-test-project-'));

  try {
    // 1. Create a buggy module: user.js
    const buggyCode = `export function getDisplayName(user) {
  return user.name;
}
`;
    fs.writeFileSync(path.join(tmpProject, 'user.js'), buggyCode, 'utf8');

    // 2. Create test file that checks getDisplayName(undefined) handles safe fallback or doesn't crash
    const testCode = `import test from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayName } from './user.js';

test('getDisplayName handles undefined user safely', () => {
  const result = getDisplayName(undefined);
  assert.equal(result, undefined);
});
`;
    fs.writeFileSync(path.join(tmpProject, 'user.test.js'), testCode, 'utf8');

    // 3. Create simulated incident
    const incident: Incident = {
      id: 'inc_test_101',
      projectId: 'test-project',
      title: 'TypeError: Cannot read properties of undefined (reading "name")',
      fingerprint: 'fp_test_101',
      status: 'OPEN',
      severity: 'HIGH',
      triggerType: 'TERMINAL_LOG',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      occurrenceCount: 1,
      errorSummary: 'Cannot read properties of undefined (reading "name")',
      stackTrace: `TypeError: Cannot read properties of undefined (reading 'name')
    at getDisplayName (${path.join(tmpProject, 'user.js')}:2:15)
    at ${path.join(tmpProject, 'user.test.js')}:5:18`,
      relatedLogs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const orchestrator = new RepairOrchestrator({
      projectRoot: tmpProject,
      testCommand: 'node --test user.test.js',
    });

    const result = await orchestrator.attemptRepair(incident);

    assert.equal(result.success, true);
    assert.equal(incident.status, 'PR_OPENED');
    assert.ok(incident.pullRequest);
    assert.ok(incident.pullRequest.title.includes('fix:'));
    assert.ok(incident.verification?.passed);
    assert.equal(incident.verification?.exitCode, 0);
  } finally {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  }
});

test('RepairOrchestrator: falls back to developer report when test suite fails in sandbox', async () => {
  const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-test-project-fail-'));

  try {
    const code = `export function divide(a, b) {
  return a / b;
}
`;
    fs.writeFileSync(path.join(tmpProject, 'math.js'), code, 'utf8');

    // Test that intentionally fails
    const failingTestCode = `import test from 'node:test';
import assert from 'node:assert/strict';

test('always failing assertion', () => {
  assert.fail('Simulated failing test suite');
});
`;
    fs.writeFileSync(path.join(tmpProject, 'math.test.js'), failingTestCode, 'utf8');

    const incident: Incident = {
      id: 'inc_test_102',
      projectId: 'test-project',
      title: 'MathError: Invalid computation',
      fingerprint: 'fp_test_102',
      status: 'OPEN',
      severity: 'HIGH',
      triggerType: 'TERMINAL_LOG',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      occurrenceCount: 1,
      errorSummary: 'Invalid computation',
      relatedLogs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const orchestrator = new RepairOrchestrator({
      projectRoot: tmpProject,
      testCommand: 'node --test math.test.js',
    });

    const result = await orchestrator.attemptRepair(incident);

    assert.equal(result.success, false);
    assert.equal(incident.status, 'REPORTED');
    assert.ok(incident.reportSummary);
    assert.ok(incident.reportSummary.includes('Agent Slink Incident Investigation Report'));
  } finally {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  }
});
