export type BrowserCheckStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface ConsoleErrorItem {
  type: string;
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: number;
}

export interface FailedRequestItem {
  url: string;
  method: string;
  status: number;
  statusText: string;
  failureText?: string;
  durationMs: number;
  timestamp: number;
}

export interface DomErrorItem {
  selector?: string;
  message: string;
  snippet?: string;
}

export interface BrowserCheckEvidence {
  checkId: string;
  projectId: string;
  targetUrl: string;
  status: BrowserCheckStatus;
  httpStatus: number;
  responseTimeMs: number;
  consoleErrors: ConsoleErrorItem[];
  failedRequests: FailedRequestItem[];
  domErrors: DomErrorItem[];
  screenshotBase64?: string;
  screenshotPath?: string;
  pageTitle?: string;
  timestamp: number;
}
