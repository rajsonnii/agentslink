import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { OpenRouterProvider, createLlmProvider } from '../provider.js';

test('OpenRouterProvider dispatches request to OpenRouter API with correct headers & model', async (t) => {
  let receivedHeaders: Record<string, any> = {};
  let receivedBody: any = null;

  // Mock server simulating OpenRouter API
  const server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      receivedBody = JSON.parse(raw);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'gen-12345',
          choices: [
            {
              message: {
                role: 'assistant',
                content: '```json\n{\n  "rootCause": "Null reference",\n  "explanation": "Object is undefined",\n  "confidence": 0.98,\n  "proposedFix": "Add optional chaining",\n  "suggestedTransformation": {\n    "searchPattern": ".prop",\n    "replacement": "?.prop"\n  }\n}\n```',
              },
            },
          ],
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as any;
  const mockEndpoint = `http://127.0.0.1:${addr.port}/api/v1/chat/completions`;

  t.after(() => server.close());

  const provider = new OpenRouterProvider('sk-or-test-key', 'google/gemini-2.0-flash-001', mockEndpoint);
  const result = await provider.generateDiagnosis('Diagnose crash: TypeError undefined');

  assert.equal(receivedHeaders['authorization'], 'Bearer sk-or-test-key');
  assert.equal(receivedHeaders['http-referer'], 'https://slink.dev');
  assert.equal(receivedHeaders['x-title'], 'Agent Slink');
  assert.equal(receivedBody.model, 'google/gemini-2.0-flash-001');
  assert.equal(receivedBody.messages.length, 2);

  const parsed = JSON.parse(result);
  assert.equal(parsed.rootCause, 'Null reference');
  assert.equal(parsed.confidence, 0.98);
  assert.equal(parsed.suggestedTransformation.replacement, '?.prop');
});

test('createLlmProvider automatically activates OpenRouterProvider when OPENROUTER_API_KEY is present', () => {
  const origKey = process.env['OPENROUTER_API_KEY'];
  try {
    process.env['OPENROUTER_API_KEY'] = 'sk-or-my-key';
    const provider = createLlmProvider();
    assert.equal(provider.name, 'OpenRouter');
  } finally {
    if (origKey !== undefined) {
      process.env['OPENROUTER_API_KEY'] = origKey;
    } else {
      delete process.env['OPENROUTER_API_KEY'];
    }
  }
});
