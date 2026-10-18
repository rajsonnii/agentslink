import { normalizeErrorMessage } from './normalizer.js';

export interface StackFrame {
  file: string;
  line?: number;
  column?: number;
  functionName?: string;
  isExternal?: boolean;
}

export interface ParsedStackTrace {
  errorType: string;
  errorMessage: string;
  frames: StackFrame[];
}

/**
 * Parses V8 / Node.js stack traces:
 * TypeError: Cannot read properties of undefined (reading 'foo')
 *     at calculateTotal (/app/src/billing.js:42:15)
 *     at /app/src/server.js:80:20
 */
export function parseNodeStackTrace(raw: string): ParsedStackTrace | null {
  const lines = raw.trim().split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0]?.trim() || '';
  const colonIndex = firstLine.indexOf(':');
  let errorType = 'Error';
  let errorMessage = firstLine;

  if (colonIndex > 0) {
    errorType = firstLine.substring(0, colonIndex).trim();
    errorMessage = firstLine.substring(colonIndex + 1).trim();
  }

  const frames: StackFrame[] = [];
  const frameRegex = /^\s*at\s+(?:(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = line.match(frameRegex);
    if (match) {
      if (match[1] && match[2]) {
        // e.g. at calculateTotal (/app/src/billing.js:42:15)
        const file = match[2];
        frames.push({
          functionName: match[1],
          file,
          line: parseInt(match[3] || '0', 10),
          column: parseInt(match[4] || '0', 10),
          isExternal: isExternalPath(file),
        });
      } else if (match[5]) {
        // e.g. at /app/src/server.js:80:20
        const file = match[5];
        frames.push({
          file,
          line: parseInt(match[6] || '0', 10),
          column: parseInt(match[7] || '0', 10),
          isExternal: isExternalPath(file),
        });
      }
    }
  }

  return {
    errorType,
    errorMessage: normalizeErrorMessage(errorMessage),
    frames,
  };
}

/**
 * Parses Python tracebacks:
 * Traceback (most recent call last):
 *   File "app.py", line 42, in handle_request
 * ZeroDivisionError: division by zero
 */
export function parsePythonTraceback(raw: string): ParsedStackTrace | null {
  if (!raw.includes('Traceback (most recent call last):')) return null;

  const lines = raw.trim().split('\n');
  const lastLine = lines[lines.length - 1]?.trim() || '';
  const colonIndex = lastLine.indexOf(':');
  let errorType = 'PythonError';
  let errorMessage = lastLine;

  if (colonIndex > 0) {
    errorType = lastLine.substring(0, colonIndex).trim();
    errorMessage = lastLine.substring(colonIndex + 1).trim();
  }

  const frames: StackFrame[] = [];
  const pyFrameRegex = /File "(.+?)", line (\d+)(?:, in (.+))?/;

  for (const line of lines) {
    const match = line.match(pyFrameRegex);
    if (match && match[1]) {
      const file = match[1];
      frames.push({
        file,
        line: parseInt(match[2] || '0', 10),
        functionName: match[3]?.trim(),
        isExternal: isExternalPath(file),
      });
    }
  }

  return {
    errorType,
    errorMessage: normalizeErrorMessage(errorMessage),
    frames,
  };
}

function isExternalPath(filePath: string): boolean {
  return (
    filePath.includes('node_modules') ||
    filePath.includes('site-packages') ||
    filePath.startsWith('node:') ||
    filePath.startsWith('internal/')
  );
}
