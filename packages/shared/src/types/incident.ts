import type { LogEntry } from './logs.js';
import type { BrowserCheckEvidence } from './browser.js';
import type { GitCommitContext, GitHubPullRequestInfo } from './git.js';
import type { DiagnosticResult, SandboxVerificationResult } from './agent.js';

export type IncidentStatus =
  | 'OPEN'          // Incident detected and created
  | 'DIAGNOSING'    // AI Agent is analyzing root cause
  | 'PATCHING'      // Agent is writing fix and running isolated tests
  | 'VERIFYING'     // Tests running in sandbox
  | 'PR_OPENED'     // Fix verified & PR submitted to GitHub
  | 'REPORTED'      // Tests could not verify fix, diagnostic report posted
  | 'RECOVERED'     // Deployed fix confirmed healthy via browser re-check
  | 'CLOSED';       // Manually or automatically resolved

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentTriggerType =
  | 'TERMINAL_LOG'
  | 'PROCESS_CRASH'
  | 'BROWSER_CHECK'
  | 'API_METRIC';

export interface Incident {
  id: string;
  projectId: string;
  title: string;
  fingerprint: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  triggerType: IncidentTriggerType;
  firstSeenAt: number;
  lastSeenAt: number;
  occurrenceCount: number;

  // Context & Evidence
  errorSummary: string;
  stackTrace?: string;
  relatedLogs: LogEntry[];
  browserEvidence?: BrowserCheckEvidence;
  recentCommits?: GitCommitContext[];

  // Resolution & Fix
  diagnosis?: DiagnosticResult;
  verification?: SandboxVerificationResult;
  pullRequest?: GitHubPullRequestInfo;
  reportSummary?: string;

  // Recovery Verification
  recoveryVerifiedAt?: number;
  recoveryCheckEvidence?: BrowserCheckEvidence;

  createdAt: number;
  updatedAt: number;
}
