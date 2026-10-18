import { randomUUID } from 'node:crypto';
import type { Incident, AgentRepairAttempt } from '@slink/shared';
import { GitInspector } from '../context/git-inspector.js';
import { CodebaseGatherer } from '../context/codebase-gatherer.js';
import { AgentDiagnostician } from '../diagnostician/diagnostician.js';
import { createLlmProvider, type LlmProvider } from '../llm/provider.js';
import { TestSandbox, type SandboxOptions } from '../sandbox/test-sandbox.js';
import { PullRequestCreator, type GitHubConfig } from '../github/pr-creator.js';
import { IncidentReporter } from '../reporter/incident-reporter.js';

export interface RepairOrchestratorOptions {
  projectRoot?: string;
  testCommand?: string;
  githubConfig?: GitHubConfig;
  llmProvider?: LlmProvider;
}

export class RepairOrchestrator {
  private projectRoot: string;
  private gitInspector: GitInspector;
  private codebaseGatherer: CodebaseGatherer;
  private diagnostician: AgentDiagnostician;
  private testCommand: string;
  private githubConfig: GitHubConfig;

  constructor(options: RepairOrchestratorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.gitInspector = new GitInspector(this.projectRoot);
    this.codebaseGatherer = new CodebaseGatherer(this.projectRoot);
    this.diagnostician = new AgentDiagnostician(options.llmProvider || createLlmProvider());
    this.testCommand = options.testCommand || 'npm test';
    this.githubConfig = options.githubConfig || {};
  }

  public async attemptRepair(incident: Incident): Promise<AgentRepairAttempt> {
    const attemptId = `att_${randomUUID().substring(0, 10)}`;
    const startTime = Date.now();

    try {
      // 1. Gather context: commits, diffs, and source code
      incident.status = 'DIAGNOSING';
      const recentCommits = await this.gitInspector.getRecentCommits(5);
      incident.recentCommits = recentCommits;
      const gatheredContext = this.codebaseGatherer.gatherContextForIncident(incident);

      // 2. Diagnose root cause and generate surgical fix
      incident.status = 'PATCHING';
      const diagnosis = await this.diagnostician.diagnose(incident, gatheredContext, recentCommits);
      incident.diagnosis = diagnosis;

      // 3. Isolated Sandbox Verification
      incident.status = 'VERIFYING';
      const sandbox = new TestSandbox({
        projectRoot: this.projectRoot,
        testCommand: this.testCommand,
      });

      const verification = await sandbox.verifyPatch(diagnosis.fileChanges);
      incident.verification = verification;

      // 4. Branching: If tests pass, open PR; If tests fail, report to developer
      if (verification.passed && diagnosis.fileChanges.length > 0) {
        const prCreator = new PullRequestCreator(this.projectRoot, this.githubConfig);
        const prInfo = await prCreator.openPullRequest(incident, diagnosis, verification);

        incident.pullRequest = prInfo;
        incident.status = 'PR_OPENED';
        incident.updatedAt = Date.now();

        return {
          id: attemptId,
          incidentId: incident.id,
          startTime,
          endTime: Date.now(),
          diagnosis,
          verification,
          success: true,
          pr: {
            number: prInfo.number,
            url: prInfo.htmlUrl,
            branch: prInfo.branch,
          },
        };
      } else {
        // Fix did not verify in sandbox
        const report = IncidentReporter.generateDeveloperReport(
          incident,
          diagnosis,
          verification,
          verification.passed
            ? 'No file modifications were identified to safely fix the issue.'
            : 'Sandbox test suite failed with proposed patch.'
        );

        incident.status = 'REPORTED';
        incident.reportSummary = report;
        incident.updatedAt = Date.now();

        return {
          id: attemptId,
          incidentId: incident.id,
          startTime,
          endTime: Date.now(),
          diagnosis,
          verification,
          success: false,
          failureReason: 'Sandbox test failure',
        };
      }
    } catch (err: any) {
      incident.status = 'REPORTED';
      incident.reportSummary = `Repair pipeline exception: ${err.message}`;
      incident.updatedAt = Date.now();

      return {
        id: attemptId,
        incidentId: incident.id,
        startTime,
        endTime: Date.now(),
        success: false,
        failureReason: err.message,
      };
    }
  }
}
