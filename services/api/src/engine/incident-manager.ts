import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentTriggerType,
  LogBatch,
  ProcessExitPayload,
  BrowserCheckEvidence,
} from '@slink/shared';
import { computeFingerprint } from '@slink/shared';
import { IncidentStore, globalIncidentStore } from '../store/incident-store.js';
import { ErrorDetector } from './error-detector.js';

export interface IncidentManagerEvents {
  'incident:created': (incident: Incident) => void;
  'incident:updated': (incident: Incident) => void;
  'incident:recovered': (incident: Incident) => void;
}

export class IncidentManager extends EventEmitter {
  private store: IncidentStore;
  // Prevent storming the agent with duplicate invocations (cooldown in ms: 5 mins)
  private debounceWindowMs: number = 5 * 60 * 1000;

  constructor(store: IncidentStore = globalIncidentStore) {
    super();
    this.store = store;
  }

  public async handleLogBatch(batch: LogBatch): Promise<Incident[]> {
    const detectedErrors = ErrorDetector.detectErrorsInBatch(batch.entries);
    const affectedIncidents: Incident[] = [];

    for (const err of detectedErrors) {
      const fingerprint = computeFingerprint({
        errorType: err.errorType,
        errorMessage: err.errorMessage,
        stackTrace: err.stackTrace,
        triggerType: 'TERMINAL_LOG',
      });

      const incident = this.upsertIncident({
        projectId: batch.projectId,
        title: `${err.errorType}: ${err.errorMessage.substring(0, 80)}`,
        fingerprint,
        severity: this.assessSeverity(err.errorType, 'TERMINAL_LOG'),
        triggerType: 'TERMINAL_LOG',
        errorSummary: err.errorMessage,
        stackTrace: err.stackTrace,
        relatedLogs: err.relatedLogs,
      });

      affectedIncidents.push(incident);
    }

    return affectedIncidents;
  }

  public async handleProcessExit(payload: ProcessExitPayload): Promise<Incident | null> {
    if (payload.code === 0 || payload.code === null) return null;

    const fingerprint = computeFingerprint({
      errorType: 'ProcessCrash',
      errorMessage: `Command '${payload.command}' terminated abnormally with exit code ${payload.code}`,
      triggerType: 'PROCESS_CRASH',
      exitCode: payload.code,
    });

    return this.upsertIncident({
      projectId: payload.projectId,
      title: `Crash: '${payload.command}' exited with code ${payload.code}`,
      fingerprint,
      severity: 'CRITICAL',
      triggerType: 'PROCESS_CRASH',
      errorSummary: `Process exit code ${payload.code} (Signal: ${payload.signal || 'NONE'})`,
      relatedLogs: [],
    });
  }

  public async handleBrowserEvidence(evidence: BrowserCheckEvidence): Promise<Incident | null> {
    if (evidence.status === 'HEALTHY') {
      // Check if this healthy check resolves an existing incident for this project
      const openIncidents = this.store
        .list({ projectId: evidence.projectId })
        .filter((inc) => inc.status === 'PR_OPENED' || inc.status === 'REPORTED');

      for (const inc of openIncidents) {
        inc.status = 'RECOVERED';
        inc.recoveryVerifiedAt = Date.now();
        inc.recoveryCheckEvidence = evidence;
        inc.updatedAt = Date.now();
        this.store.save(inc);
        this.emit('incident:recovered', inc);
      }
      return null;
    }

    // Build fingerprint from browser failure
    const primaryError =
      evidence.consoleErrors[0]?.text ||
      evidence.failedRequests[0]?.failureText ||
      `HTTP status ${evidence.httpStatus} on ${evidence.targetUrl}`;

    const fingerprint = computeFingerprint({
      errorType: 'BrowserHealthFailure',
      errorMessage: primaryError,
      triggerType: 'BROWSER_CHECK',
      url: evidence.targetUrl,
    });

    return this.upsertIncident({
      projectId: evidence.projectId,
      title: `Browser Check Failed (${evidence.httpStatus}) on ${evidence.targetUrl}`,
      fingerprint,
      severity: evidence.status === 'DOWN' ? 'CRITICAL' : 'HIGH',
      triggerType: 'BROWSER_CHECK',
      errorSummary: primaryError,
      relatedLogs: [],
      browserEvidence: evidence,
    });
  }

  private upsertIncident(params: {
    projectId: string;
    title: string;
    fingerprint: string;
    severity: IncidentSeverity;
    triggerType: IncidentTriggerType;
    errorSummary: string;
    stackTrace?: string;
    relatedLogs: any[];
    browserEvidence?: BrowserCheckEvidence;
  }): Incident {
    const existing = this.store.getByFingerprint(params.fingerprint);

    const now = Date.now();

    if (existing) {
      existing.occurrenceCount += 1;
      existing.lastSeenAt = now;
      existing.updatedAt = now;

      // Keep recent logs bounded to prevent unbounded memory growth
      if (params.relatedLogs.length > 0) {
        existing.relatedLogs = [...existing.relatedLogs, ...params.relatedLogs].slice(-50);
      }
      if (params.browserEvidence) {
        existing.browserEvidence = params.browserEvidence;
      }
      if (params.stackTrace && !existing.stackTrace) {
        existing.stackTrace = params.stackTrace;
      }

      this.store.save(existing);
      this.emit('incident:updated', existing);
      return existing;
    }

    const newIncident: Incident = {
      id: `inc_${randomUUID().substring(0, 12)}`,
      projectId: params.projectId,
      title: params.title,
      fingerprint: params.fingerprint,
      status: 'OPEN',
      severity: params.severity,
      triggerType: params.triggerType,
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1,
      errorSummary: params.errorSummary,
      stackTrace: params.stackTrace,
      relatedLogs: params.relatedLogs.slice(-50),
      browserEvidence: params.browserEvidence,
      createdAt: now,
      updatedAt: now,
    };

    this.store.save(newIncident);
    this.emit('incident:created', newIncident);
    return newIncident;
  }

  public updateStatus(incidentId: string, status: IncidentStatus): Incident | null {
    const inc = this.store.getById(incidentId);
    if (!inc) return null;
    inc.status = status;
    inc.updatedAt = Date.now();
    this.store.save(inc);
    this.emit('incident:updated', inc);
    return inc;
  }

  private assessSeverity(errorType: string, trigger: IncidentTriggerType): IncidentSeverity {
    if (trigger === 'PROCESS_CRASH') return 'CRITICAL';
    if (['SyntaxError', 'ReferenceError', 'RangeError'].includes(errorType)) return 'HIGH';
    if (['TypeError', 'UnhandledPromiseRejection'].includes(errorType)) return 'HIGH';
    return 'MEDIUM';
  }
}

export const globalIncidentManager = new IncidentManager();
