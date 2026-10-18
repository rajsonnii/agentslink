import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { globalIncidentStore } from '../store/incident-store.js';

test('Agent Slink API integration tests', async (t) => {
  const app = await createServer();

  t.beforeEach(() => {
    globalIncidentStore.clear();
  });

  t.after(async () => {
    await app.close();
  });

  await t.test('GET /health returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });

  await t.test('POST /api/v1/logs/batch detects error and opens incident', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/logs/batch',
      payload: {
        sessionId: 'sess-1',
        projectId: 'test-app',
        command: 'npm start',
        timestamp: Date.now(),
        entries: [
          {
            id: 'log-1',
            timestamp: Date.now(),
            stream: 'stdout',
            message: 'App listening on port 3000',
          },
          {
            id: 'log-2',
            timestamp: Date.now(),
            stream: 'stderr',
            message: 'TypeError: Cannot read properties of undefined (reading "user")',
          },
          {
            id: 'log-3',
            timestamp: Date.now(),
            stream: 'stderr',
            message: '    at handleRequest (/app/src/server.js:42:15)',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.incidentsTriggered, 1);

    const incidents = globalIncidentStore.list({ projectId: 'test-app' });
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0]?.status, 'OPEN');
    assert.equal(incidents[0]?.occurrenceCount, 1);
    assert.ok(incidents[0]?.fingerprint);
  });

  await t.test('POST /api/v1/logs/batch deduplicates repeated occurrences of the same error', async () => {
    const payload = {
      sessionId: 'sess-2',
      projectId: 'test-app',
      command: 'npm start',
      timestamp: Date.now(),
      entries: [
        {
          id: 'log-10',
          timestamp: Date.now(),
          stream: 'stderr',
          message: 'TypeError: Cannot read properties of undefined (reading "user")',
        },
        {
          id: 'log-11',
          timestamp: Date.now(),
          stream: 'stderr',
          message: '    at handleRequest (/app/src/server.js:42:15)',
        },
      ],
    };

    // First burst
    await app.inject({ method: 'POST', url: '/api/v1/logs/batch', payload });
    // Second burst with same error
    await app.inject({ method: 'POST', url: '/api/v1/logs/batch', payload });

    const incidents = globalIncidentStore.list({ projectId: 'test-app' });
    assert.equal(incidents.length, 1, 'Should NOT create duplicate incident');
    assert.equal(incidents[0]?.occurrenceCount, 2, 'Should increment occurrence count');
  });

  await t.test('Browser watcher report triggers incident and healthy re-check marks RECOVERED', async () => {
    // 1. Browser check reports 500 error
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/browser/report',
      payload: {
        checkId: 'check-1',
        projectId: 'test-app',
        targetUrl: 'https://test-app.com/dashboard',
        status: 'DOWN',
        httpStatus: 500,
        responseTimeMs: 350,
        consoleErrors: [{ type: 'error', text: 'Internal Server Error (500)', timestamp: Date.now() }],
        failedRequests: [
          {
            url: 'https://test-app.com/api/data',
            method: 'GET',
            status: 500,
            statusText: 'Internal Server Error',
            durationMs: 150,
            timestamp: Date.now(),
          },
        ],
        domErrors: [],
        timestamp: Date.now(),
      },
    });

    assert.equal(failRes.statusCode, 200);
    const failBody = JSON.parse(failRes.body);
    assert.ok(failBody.incident);

    // Simulate PR opened for this incident
    const inc = globalIncidentStore.getById(failBody.incident.id)!;
    inc.status = 'PR_OPENED';
    globalIncidentStore.save(inc);

    // 2. Headless browser re-check after fix deployment reports HEALTHY
    const recoverRes = await app.inject({
      method: 'POST',
      url: '/api/v1/browser/report',
      payload: {
        checkId: 'check-2',
        projectId: 'test-app',
        targetUrl: 'https://test-app.com/dashboard',
        status: 'HEALTHY',
        httpStatus: 200,
        responseTimeMs: 80,
        consoleErrors: [],
        failedRequests: [],
        domErrors: [],
        timestamp: Date.now(),
      },
    });

    assert.equal(recoverRes.statusCode, 200);
    const updatedInc = globalIncidentStore.getById(failBody.incident.id)!;
    assert.equal(updatedInc.status, 'RECOVERED');
    assert.ok(updatedInc.recoveryVerifiedAt);
  });
});
