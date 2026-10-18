import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { loadSlinkConfig, saveSlinkConfig } from '../loader.js';

test('loadSlinkConfig returns defaults when no file is present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-test-'));
  const config = loadSlinkConfig(tmpDir);
  assert.equal(config.projectId, 'default-project');
  assert.equal(config.apiUrl, 'http://localhost:4000');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('saveSlinkConfig and loadSlinkConfig persist project config', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-test-'));
  saveSlinkConfig(
    {
      projectId: 'my-custom-app',
      apiUrl: 'https://slink.custom.com',
      autoHeal: false,
    },
    tmpDir
  );

  const loaded = loadSlinkConfig(tmpDir);
  assert.equal(loaded.projectId, 'my-custom-app');
  assert.equal(loaded.apiUrl, 'https://slink.custom.com');
  assert.equal(loaded.autoHeal, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
