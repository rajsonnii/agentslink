import type { LogEntry } from '@slink/shared';

export interface DetectedError {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  sourceLog: LogEntry;
  relatedLogs: LogEntry[];
}

/**
 * Scans log entries to detect runtime errors, unhandled exceptions, and stack traces.
 */
export class ErrorDetector {
  // Regex to detect common error header lines
  private static readonly ERROR_HEADER_REGEX =
    /^(?:(?:\w+Error|Exception|Panic|FATAL|Crash|AssertionError):\s*(.+)|.*(?:Uncaught exception|UnhandledPromiseRejection|FATAL ERROR).*)/i;

  // Regex to detect stack trace lines (Node: "    at ...", Python: "  File ...", Go: "\tgoroutine ...")
  private static readonly STACK_LINE_REGEX =
    /^\s*(?:at\s+|File\s+"|\tgoroutine\s+|\s+in\s+|Traceback\s*\(most recent call last\))/;

  public static detectErrorsInBatch(entries: LogEntry[]): DetectedError[] {
    const detected: DetectedError[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const msg = entry.message.trim();

      // Check if entry itself is marked as error or matches error header pattern
      const isErrorCandidate =
        entry.stream === 'stderr' ||
        entry.isError ||
        this.ERROR_HEADER_REGEX.test(msg) ||
        msg.includes('Error:') ||
        msg.includes('Exception:');

      if (!isErrorCandidate) continue;

      // Extract error type & message
      let errorType = 'RuntimeError';
      let errorMessage = msg;

      const typeMatch = msg.match(/^([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception):\s*(.*)/);
      if (typeMatch && typeMatch[1]) {
        errorType = typeMatch[1];
        errorMessage = typeMatch[2] || msg;
      }

      // Collect consecutive stack trace lines if following entries belong to the same trace
      const stackLines: string[] = [msg];
      let j = i + 1;
      while (j < entries.length && j < i + 30) {
        const nextEntry = entries[j]!;
        if (this.STACK_LINE_REGEX.test(nextEntry.message)) {
          stackLines.push(nextEntry.message);
          j++;
        } else {
          break;
        }
      }

      const stackTrace = stackLines.length > 1 ? stackLines.join('\n') : undefined;

      // Context window: take 10 preceding lines and 5 following lines
      const startIdx = Math.max(0, i - 10);
      const endIdx = Math.min(entries.length, Math.max(j, i + 5));
      const relatedLogs = entries.slice(startIdx, endIdx);

      detected.push({
        errorType,
        errorMessage,
        stackTrace,
        sourceLog: entry,
        relatedLogs,
      });

      // Advance index past stack trace
      if (j > i + 1) {
        i = j - 1;
      }
    }

    return detected;
  }
}
