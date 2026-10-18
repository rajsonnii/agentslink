export interface FileChange {
  path: string;
  originalContent: string;
  modifiedContent: string;
  diff: string;
}

export interface DiagnosticResult {
  rootCause: string;
  explanation: string;
  confidence: number; // 0.0 to 1.0
  affectedFiles: string[];
  proposedFix: string;
  fileChanges: FileChange[];
  unifiedDiff: string;
}

export interface SandboxVerificationResult {
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  testCount?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export interface AgentRepairAttempt {
  id: string;
  incidentId: string;
  startTime: number;
  endTime?: number;
  diagnosis?: DiagnosticResult;
  verification?: SandboxVerificationResult;
  success: boolean;
  pr?: {
    number: number;
    url: string;
    branch: string;
  };
  failureReason?: string;
}
