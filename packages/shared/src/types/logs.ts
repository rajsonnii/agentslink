export type LogStreamType = 'stdout' | 'stderr' | 'system';

export interface LogEntry {
  id: string;
  timestamp: number;
  stream: LogStreamType;
  message: string;
  raw?: string;
  pid?: number;
  isError?: boolean;
}

export interface LogBatch {
  sessionId: string;
  projectId: string;
  command: string;
  entries: LogEntry[];
  timestamp: number;
}

export interface ProcessExitPayload {
  sessionId: string;
  projectId: string;
  command: string;
  code: number | null;
  signal: string | null;
  timestamp: number;
}
