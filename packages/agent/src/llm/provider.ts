export interface LlmProvider {
  name: string;
  generateDiagnosis(prompt: string): Promise<string>;
}

/**
 * OpenRouter Provider
 * Connects to OpenRouter's unified API to access affordable, high-performance models
 * Default: google/gemini-2.0-flash-001 (fast, exceptional code intelligence, ~$0.10/1M tokens)
 * Alternative affordable models: deepseek/deepseek-chat, meta-llama/llama-3.3-70b-instruct, qwen/qwen-2.5-coder-32b-instruct
 */
export class OpenRouterProvider implements LlmProvider {
  public name = 'OpenRouter';
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(
    apiKey: string,
    model: string = process.env['OPENROUTER_MODEL'] || 'google/gemini-2.0-flash-001',
    endpoint: string = 'https://openrouter.ai/api/v1/chat/completions'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
  }

  public async generateDiagnosis(prompt: string): Promise<string> {
    const systemPrompt = `You are Agent Slink, an autonomous site-reliability and code-repair AI.
You diagnose application errors, identify root causes, and propose surgical, minimal fixes.
You MUST output strictly valid JSON matching this schema with no markdown fences, no backticks, and no commentary:
{
  "rootCause": "Clear explanation of the bug",
  "explanation": "Technical details of why it occurred",
  "confidence": 0.95,
  "proposedFix": "Summary of the fix",
  "suggestedTransformation": {
    "searchPattern": "exact line or substring in original file to replace",
    "replacement": "replacement string with the fix applied"
  }
}`;

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://slink.dev',
        'X-Title': 'Agent Slink',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter API error (${res.status}): ${errText || res.statusText}`);
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    // Strip any markdown code fences if model returned ```json ... ```
    const cleaned = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return cleaned;
  }
}

/**
 * Deterministic pattern-based diagnostic provider for offline testing and standard bug patterns
 * (e.g., null/undefined property accesses, missing guards, type errors, uncaught promise rejections).
 */
export class RuleBasedDiagnosticProvider implements LlmProvider {
  public name = 'RuleBased';

  public async generateDiagnosis(prompt: string): Promise<string> {
    // If prompt contains undefined property access pattern
    if (prompt.includes('Cannot read properties of undefined') || prompt.includes('TypeError')) {
      const match = prompt.match(/Cannot read properties of undefined \(reading ['"]?(\w+)['"]?\)/);
      const propName = match ? match[1] : 'prop';

      return JSON.stringify({
        rootCause: `Unhandled null or undefined value when accessing property '${propName}'.`,
        explanation: `The application attempted to dereference property '${propName}' on an undefined reference without a prior null check or optional chaining guard.`,
        confidence: 0.95,
        proposedFix: `Added defensive check / optional chaining (?.) for '${propName}'.`,
        targetFileKeyword: '.js',
        suggestedTransformation: {
          searchPattern: `.${propName}`,
          replacement: `?.${propName}`,
        },
      });
    }

    // Default fallback diagnosis
    return JSON.stringify({
      rootCause: 'Runtime application failure detected from stack trace logs.',
      explanation: 'Application crashed during request execution due to uncaught error.',
      confidence: 0.8,
      proposedFix: 'Applied error boundary guard and parameter validation.',
      targetFileKeyword: '',
      suggestedTransformation: null,
    });
  }
}

/**
 * Generic API LLM Provider for Gemini or OpenAI direct endpoints
 */
export class ApiLlmProvider implements LlmProvider {
  public name: string;
  private apiKey: string;
  private endpoint: string;

  constructor(name: string, apiKey: string, endpoint: string) {
    this.name = name;
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  public async generateDiagnosis(prompt: string): Promise<string> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM provider error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return data.output || data.choices?.[0]?.message?.content || '';
  }
}

export function createLlmProvider(): LlmProvider {
  // 1. OpenRouter (Primary & recommended affordable provider)
  const openRouterKey = process.env['OPENROUTER_API_KEY'];
  if (openRouterKey) {
    const model = process.env['OPENROUTER_MODEL'] || 'google/gemini-2.0-flash-001';
    return new OpenRouterProvider(openRouterKey, model);
  }

  // 2. Direct Gemini or OpenAI fallback
  if (process.env['GEMINI_API_KEY']) {
    return new ApiLlmProvider('Gemini', process.env['GEMINI_API_KEY'], 'https://generativelanguage.googleapis.com/v1beta');
  }
  if (process.env['OPENAI_API_KEY']) {
    return new ApiLlmProvider('OpenAI', process.env['OPENAI_API_KEY'], 'https://api.openai.com/v1/chat/completions');
  }

  // 3. Deterministic rule-based engine (offline dev & test environments)
  return new RuleBasedDiagnosticProvider();
}
