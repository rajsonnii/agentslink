export interface LlmProvider {
  name: string;
  generateDiagnosis(prompt: string): Promise<string>;
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
 * Generic API LLM Provider for Gemini, OpenAI, or Anthropic
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
  if (process.env['GEMINI_API_KEY']) {
    return new ApiLlmProvider('Gemini', process.env['GEMINI_API_KEY'], 'https://generativelanguage.googleapis.com/v1beta');
  }
  if (process.env['OPENAI_API_KEY']) {
    return new ApiLlmProvider('OpenAI', process.env['OPENAI_API_KEY'], 'https://api.openai.com/v1/chat/completions');
  }
  return new RuleBasedDiagnosticProvider();
}
