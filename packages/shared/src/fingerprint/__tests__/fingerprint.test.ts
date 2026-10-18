import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeErrorMessage } from '../normalizer.js';
import { parseNodeStackTrace } from '../stacktrace.js';
import { computeFingerprint } from '../hasher.js';

test('normalizeErrorMessage strips timestamps, UUIDs and addresses', () => {
  const raw = 'Failed at 2026-10-18T16:21:30.123Z with id 123e4567-e89b-12d3-a456-426614174000 at 0x7fff5fbff820 on localhost:3000';
  const normalized = normalizeErrorMessage(raw);
  assert.equal(normalized, 'Failed at <TIMESTAMP> with id <UUID> at <HEX> on localhost:<PORT>');
});

test('parseNodeStackTrace extracts error type and application frames', () => {
  const stack = `TypeError: Cannot read properties of undefined (reading 'token')
    at authenticateUser (/app/src/auth/service.js:45:12)
    at /app/node_modules/express/lib/router/layer.js:95:5`;

  const parsed = parseNodeStackTrace(stack);
  assert.ok(parsed);
  assert.equal(parsed.errorType, 'TypeError');
  assert.equal(parsed.errorMessage, "Cannot read properties of undefined (reading 'token')");
  assert.equal(parsed.frames.length, 2);
  assert.equal(parsed.frames[0]?.functionName, 'authenticateUser');
  assert.equal(parsed.frames[0]?.isExternal, false);
  assert.equal(parsed.frames[1]?.isExternal, true);
});

test('computeFingerprint generates identical hash for equivalent errors with dynamic noise', () => {
  const error1 = {
    errorMessage: 'Connection failed at 2026-10-18T16:21:30.123Z with session 123e4567-e89b-12d3-a456-426614174000',
    stackTrace: `Error: Connection timeout
    at Query.run (/app/src/db.js:10:5)
    at /app/node_modules/pg/lib/client.js:20:10`,
  };

  const error2 = {
    errorMessage: 'Connection failed at 2026-10-18T16:25:00.999Z with session 987fcdeb-51a2-43d7-9012-345678901234',
    stackTrace: `Error: Connection timeout
    at Query.run (/app/src/db.js:10:5)
    at /app/node_modules/pg/lib/client.js:20:10`,
  };

  const fp1 = computeFingerprint(error1);
  const fp2 = computeFingerprint(error2);

  assert.equal(fp1, fp2, 'Fingerprints should match despite different timestamps and UUIDs');
});
