import type { Incident, DiagnosticResult, SandboxVerificationResult } from '@slink/shared';

export class IncidentReporter {
  public static generateDeveloperReport(
    incident: Incident,
    diagnosis?: DiagnosticResult,
    verification?: SandboxVerificationResult,
    reason?: string
  ): string {
    return `# 🦎 Agent Slink Incident Investigation Report: ${incident.title}

## Summary
- **Incident ID:** \`${incident.id}\`
- **Trigger:** \`${incident.triggerType}\`
- **Status:** ⚠️ Requires Developer Review
- **Investigation Reason:** ${reason || 'Fix could not be fully verified by project test suite in sandbox.'}

---

## 🔍 Root Cause Analysis
${diagnosis ? diagnosis.rootCause : 'Automated root cause determination incomplete.'}

${diagnosis ? `> ${diagnosis.explanation}` : ''}

---

## 🧪 Sandbox Test Outcome
${
  verification
    ? `
- **Exit Code:** \`${verification.exitCode}\` (Failed)
- **Duration:** \`${verification.durationMs}ms\`

### Test Output:
\`\`\`
${(verification.stderr || verification.stdout).slice(-2000)}
\`\`\`
`
    : 'Sandbox execution was skipped or could not run.'
}

---

## 💡 Recommended Next Steps
1. Inspect the affected files: ${diagnosis?.affectedFiles.map((f) => `\`${f}\``).join(', ') || 'N/A'}.
2. Check recent commits: ${incident.recentCommits?.map((c) => `\`${c.shortSha}\``).join(', ') || 'None'}.
3. Re-run local test suite.
`;
  }
}
