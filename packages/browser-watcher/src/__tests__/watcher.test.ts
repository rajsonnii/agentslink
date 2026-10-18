import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpBrowserEngine } from '../engine/http-engine.js';

test('HttpBrowserEngine correctly classifies healthy and broken web endpoints', async (t) => {
  let isBroken = false;

  // Spin up a mini mock web server
  const server = http.createServer((req, res) => {
    if (isBroken) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>500 Internal Error</title></head><body><h1>500 Internal Server Error</h1><p>TypeError: Cannot read property</p></body></html>');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>My Awesome App</title></head><body><h1>Welcome to My App</h1></body></html>');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const targetUrl = `http://127.0.0.1:${address.port}/`;

  t.after(() => {
    server.close();
  });

  const engine = new HttpBrowserEngine();

  // Test 1: Healthy site
  const healthyEvidence = await engine.runCheck({
    projectId: 'test-project',
    targetUrl,
  });

  assert.equal(healthyEvidence.status, 'HEALTHY');
  assert.equal(healthyEvidence.httpStatus, 200);
  assert.equal(healthyEvidence.pageTitle, 'My Awesome App');
  assert.equal(healthyEvidence.domErrors.length, 0);

  // Test 2: Broken site (simulating deployment breakage)
  isBroken = true;
  const brokenEvidence = await engine.runCheck({
    projectId: 'test-project',
    targetUrl,
  });

  assert.equal(brokenEvidence.status, 'DOWN');
  assert.equal(brokenEvidence.httpStatus, 500);
  assert.ok(brokenEvidence.domErrors.length > 0);
});
