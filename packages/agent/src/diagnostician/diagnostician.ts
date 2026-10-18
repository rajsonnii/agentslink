import { createPatch } from 'diff';
import type { Incident, DiagnosticResult, FileChange } from '@slink/shared';
import type { LlmProvider } from '../llm/provider.js';
import type { GatheredContext } from '../context/codebase-gatherer.js';
import type { GitCommitContext } from '@slink/shared';

export class AgentDiagnostician {
  private llm: LlmProvider;

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  public async diagnose(
    incident: Incident,
    context: GatheredContext,
    recentCommits: GitCommitContext[] = []
  ): Promise<DiagnosticResult> {
    const prompt = this.buildPrompt(incident, context, recentCommits);
    const rawResponse = await this.llm.generateDiagnosis(prompt);

    let parsed: any;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      parsed = {
        rootCause: 'Failed to parse structured LLM response',
        explanation: rawResponse,
        confidence: 0.5,
        proposedFix: 'Manual review required',
      };
    }

    const fileChanges: FileChange[] = [];
    let combinedDiff = '';

    // Apply transformation if snippet was found
    if (parsed.suggestedTransformation && context.snippets.length > 0) {
      const primarySnippet = context.snippets[0]!;
      const original = primarySnippet.fullFileContent;

      let modified = original;
      const { searchPattern, replacement } = parsed.suggestedTransformation;
      if (searchPattern && modified.includes(searchPattern)) {
        modified = modified.replace(searchPattern, replacement);
      }

      if (modified !== original) {
        const patch = createPatch(
          primarySnippet.relativeFilePath,
          original,
          modified,
          'before',
          'after'
        );

        fileChanges.push({
          path: primarySnippet.relativeFilePath,
          originalContent: original,
          modifiedContent: modified,
          diff: patch,
        });

        combinedDiff += patch + '\n';
      }
    }

    return {
      rootCause: parsed.rootCause || 'Unknown runtime error',
      explanation: parsed.explanation || incident.errorSummary,
      confidence: parsed.confidence || 0.8,
      affectedFiles: fileChanges.map((f) => f.path),
      proposedFix: parsed.proposedFix || 'Defensive fix applied',
      fileChanges,
      unifiedDiff: combinedDiff,
    };
  }

  private buildPrompt(
    incident: Incident,
    context: GatheredContext,
    recentCommits: GitCommitContext[]
  ): string {
    const snippetsText = context.snippets
      .map(
        (s) =>
          `File: ${s.relativeFilePath} (lines ${s.startLine}-${s.endLine}):\n\`\`\`\n${s.content}\n\`\`\``
      )
      .join('\n\n');

    const commitsText = recentCommits
      .map((c) => `- [${c.shortSha}] ${c.message} (${c.author}) - changed: ${c.changedFiles.join(', ')}`)
      .join('\n');

    return `
You are Agent Slink, an autonomous site-reliability and self-healing agent.
An incident has been detected in a production/staging application:

Incident Title: ${incident.title}
Error Summary: ${incident.errorSummary}
Stack Trace:
${incident.stackTrace || 'None available'}

Browser Evidence:
${incident.browserEvidence ? `Status: ${incident.browserEvidence.status}, HTTP: ${incident.browserEvidence.httpStatus}` : 'None'}

Recent Git Commits:
${commitsText || 'No recent commits recorded'}

Relevant Source Code Snippets:
${snippetsText || 'No direct source match found in repository'}

Please diagnose the root cause, determine why this happened, and provide a verified surgical fix.
`;
  }
}
