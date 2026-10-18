import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from '../../services/api/dist/server.js';
import { globalIncidentStore } from '../../services/api/dist/store/incident-store.js';
import { LogStreamer } from '../../packages/cli/dist/streamer/log-streamer.js';
import { RepairOrchestrator } from '../../packages/agent/dist/orchestrator/repair-orchestrator.js';
import { HttpBrowserEngine } from '../../packages/browser-watcher/dist/engine/http-engine.js';
import http from 'node:http';

test('End-to-End: Full Gecko Self-Healing Recovery Loop', async (t) => {
  try {
    // 1. Initialize API server on an ephemeral port
    const apiServer = await createServer();
  await apiServer.listen({ port: 0, host: '127.0.0.1' });
  const apiAddress = apiServer.server.address() as any;
  const apiUrl = `http://127.0.0.1:${apiAddress.port}`;

  // 2. Prepare temporary project workspace
  const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-e2e-project-'));

  // Create application file with a bug
  const appFile = path.join(tmpProject, 'server.js');
  fs.writeFileSync(
    appFile,
    `export function handleOrder(order) {
  return order.total;
}
`,
    'utf8'
  );

  // Create test suite that tests handleOrder with undefined order
  const testFile = path.join(tmpProject, 'server.test.js');
  fs.writeFileSync(
    testFile,
    `import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOrder } from './server.js';

test('handleOrder safely handles empty order', () => {
  const result = handleOrder(undefined);
  assert.equal(result, undefined);
});
`,
    'utf8'
  );

  // 3. Create simulated user web server that fails initially, then recovers after fix
  let isServiceHealthy = false;
  const webAppServer = http.createServer((req, res) => {
    if (isServiceHealthy) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Order Service</title></head><body><h1>Healthy</h1></body></html>');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>500 Internal Server Error</title></head><body><h1>Crash</h1></body></html>');
    }
  });

  await new Promise<void>((resolve) => webAppServer.listen(0, '127.0.0.1', () => resolve()));
  const webAddress = webAppServer.address() as any;
  const webAppUrl = `http://127.0.0.1:${webAddress.port}/`;

  t.after(async () => {
    await apiServer.close();
    webAppServer.close();
    fs.rmSync(tmpProject, { recursive: true, force: true });
    globalIncidentStore.clear();
  });

  // STEP 1: Slink CLI log streaming and error detection
  const streamer = new LogStreamer(
    { projectId: 'order-service', apiUrl },
    'node server.js'
  );

  streamer.appendLog('stdout', 'Server started on port 3000');
  streamer.appendLog(
    'stderr',
    "TypeError: Cannot read properties of undefined (reading 'total')"
  );
  streamer.appendLog('stderr', `    at handleOrder (${appFile}:2:15)`);
  streamer.appendLog('stderr', `    at ${testFile}:5:18`);

  await streamer.flush();

  // Verify incident opened in Slink API
  const incidents = globalIncidentStore.list({ projectId: 'order-service' });
  assert.equal(incidents.length, 1, 'API should have created exactly 1 incident');
  const incident = incidents[0]!;
  assert.equal(incident.status, 'OPEN');
  assert.ok(incident.title.includes('TypeError'));

  // STEP 2: Error deduplication check
  // Stream the same error again
  streamer.appendLog(
    'stderr',
    "TypeError: Cannot read properties of undefined (reading 'total')"
  );
  streamer.appendLog('stderr', `    at handleOrder (${appFile}:2:15)`);
  streamer.appendLog('stderr', `    at ${testFile}:5:18`);
  await streamer.flush();
  await new Promise((resolve) => setTimeout(resolve, 80));

  const refreshedIncidents = globalIncidentStore.list({ projectId: 'order-service' });
  assert.equal(refreshedIncidents.length, 1, 'Should not create duplicate incidents');
  assert.equal(refreshedIncidents[0]!.occurrenceCount, 2, 'Occurrence count should increment');

  // STEP 3: Headless Browser Watcher detects degradation
  const browserEngine = new HttpBrowserEngine();
  const initialBrowserCheck = await browserEngine.runCheck({
    projectId: 'order-service',
    targetUrl: webAppUrl,
  });

  assert.equal(initialBrowserCheck.status, 'DOWN');
  assert.equal(initialBrowserCheck.httpStatus, 500);

  // Post browser report to API
  await fetch(`${apiUrl}/api/v1/browser/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initialBrowserCheck),
  });

  // STEP 4: AI Agent Diagnoses, Patches & Verifies in Sandbox
  const orchestrator = new RepairOrchestrator({
    projectRoot: tmpProject,
    testCommand: 'node --test server.test.js',
    githubConfig: {
      repoOwner: 'my-org',
      repoName: 'order-service',
    },
  });

  const repairResult = await orchestrator.attemptRepair(incident);

  assert.equal(repairResult.success, true, 'AI repair pipeline should succeed');
  assert.equal(incident.status, 'PR_OPENED');
  assert.ok(incident.pullRequest, 'Pull request details must be populated');
  assert.ok(incident.pullRequest.htmlUrl.includes('/pull/'));
  assert.ok(incident.pullRequest.body.includes('Isolated Sandbox Verification'));
  assert.equal(incident.verification?.passed, true);

  // STEP 5: Post-deployment Recovery Verification via Headless Browser
  // Deploy fix (simulating service recovery)
  isServiceHealthy = true;

  const recoveryBrowserCheck = await browserEngine.runCheck({
    projectId: 'order-service',
    targetUrl: webAppUrl,
  });

  assert.equal(recoveryBrowserCheck.status, 'HEALTHY');
  assert.equal(recoveryBrowserCheck.httpStatus, 200);

  // Report healthy browser check back to Slink API
  await fetch(`${apiUrl}/api/v1/browser/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recoveryBrowserCheck),
  });

  // Confirm Incident transitioned to RECOVERED
  const resolvedIncident = globalIncidentStore.getById(incident.id)!;
  assert.equal(resolvedIncident.status, 'RECOVERED');
  assert.ok(resolvedIncident.recoveryVerifiedAt);
  } catch (err: any) {
    console.error('E2E TEST FAILURE:', err);
    throw err;
  }
});
