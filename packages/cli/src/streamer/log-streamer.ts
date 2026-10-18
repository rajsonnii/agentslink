import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { LogBatch, LogEntry, LogStreamType, ProcessExitPayload } from '@slink/shared';
import type { SlinkConfig } from '../config/loader.js';

export interface StreamerOptions {
  batchSize?: number;
  flushIntervalMs?: number;
}

export class LogStreamer {
  private config: SlinkConfig;
  private sessionId: string;
  private command: string;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private batchSize: number;
  private flushIntervalMs: number;
  private ws: WebSocket | null = null;
  private isWsReady: boolean = false;
  private isShuttingDown: boolean = false;

  constructor(config: SlinkConfig, command: string, options: StreamerOptions = {}) {
    this.config = config;
    this.command = command;
    this.sessionId = randomUUID();
    this.batchSize = options.batchSize ?? 30;
    this.flushIntervalMs = options.flushIntervalMs ?? 250;
    this.initWebSocket();
    this.startPeriodicFlush();
  }

  private initWebSocket(): void {
    try {
      const wsUrl = this.config.apiUrl.replace(/^http/, 'ws');
      const target = `${wsUrl}/ws/logs?projectId=${encodeURIComponent(this.config.projectId)}&sessionId=${this.sessionId}`;

      this.ws = new WebSocket(target, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      });

      this.ws.on('open', () => {
        this.isWsReady = true;
        // Send initial handshake
        this.ws?.send(
          JSON.stringify({
            type: 'SESSION_START',
            sessionId: this.sessionId,
            projectId: this.config.projectId,
            command: this.command,
            timestamp: Date.now(),
          })
        );
      });

      this.ws.on('error', () => {
        // Silently degrade to HTTP batching if WebSocket is unreachable
        this.isWsReady = false;
      });

      this.ws.on('close', () => {
        this.isWsReady = false;
      });
    } catch {
      this.isWsReady = false;
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.flushIntervalMs);
  }

  public appendLog(stream: LogStreamType, message: string, raw?: string, pid?: number): void {
    if (this.isShuttingDown) return;

    // Detect if this line looks like an error/exception
    const isError =
      stream === 'stderr' ||
      /\b(?:Error|Exception|Panic|FATAL|Crash|Traceback|SyntaxError|TypeError|ReferenceError)\b/i.test(message);

    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      stream,
      message,
      raw,
      pid,
      isError,
    };

    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch(() => {});
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entriesToSend = this.buffer.splice(0, this.buffer.length);
    const batch: LogBatch = {
      sessionId: this.sessionId,
      projectId: this.config.projectId,
      command: this.command,
      entries: entriesToSend,
      timestamp: Date.now(),
    };

    // Attempt WebSocket transmission if connected
    if (this.isWsReady && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'LOG_BATCH', payload: batch }));
        return;
      } catch {
        // If WebSocket send fails, fall through to HTTP
        this.isWsReady = false;
      }
    }

    // HTTP POST fallback
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/logs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        // If server returns error, put entries back into buffer (up to a limit to prevent memory leak)
        if (this.buffer.length < 500) {
          this.buffer.unshift(...entriesToSend);
        }
      }
    } catch {
      // Re-queue on network error if buffer isn't overflowing
      if (this.buffer.length < 500) {
        this.buffer.unshift(...entriesToSend);
      }
    }
  }

  public async notifyExit(code: number | null, signal: string | null): Promise<void> {
    this.isShuttingDown = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining logs first
    await this.flush();

    const payload: ProcessExitPayload = {
      sessionId: this.sessionId,
      projectId: this.config.projectId,
      command: this.command,
      code,
      signal,
      timestamp: Date.now(),
    };

    if (this.isWsReady && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'PROCESS_EXIT', payload }));
        this.ws.close();
      } catch {}
    }

    try {
      await fetch(`${this.config.apiUrl}/api/v1/logs/exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch {}
  }
}
