import { createHash } from 'node:crypto';
import { normalizeErrorMessage } from './normalizer.js';
import { parseNodeStackTrace, parsePythonTraceback, type StackFrame } from './stacktrace.js';

export interface FingerprintSource {
  errorType?: string;
  errorMessage: string;
  stackTrace?: string;
  triggerType?: string;
  url?: string;
  exitCode?: number | null;
}

/**
 * Computes a deterministic SHA-256 fingerprint from an error or incident trigger.
 * Deduplicates identical issues even if timestamps, memory addresses, or line offsets differ slightly.
 */
export function computeFingerprint(source: FingerprintSource): string {
  const hash = createHash('sha256');

  // 1. Process stack trace if provided
  let topFrames: StackFrame[] = [];
  let errorType = source.errorType || 'Error';
  let message = source.errorMessage;

  if (source.stackTrace) {
    const parsedNode = parseNodeStackTrace(source.stackTrace);
    if (parsedNode) {
      errorType = parsedNode.errorType;
      message = parsedNode.errorMessage;
      topFrames = parsedNode.frames;
    } else {
      const parsedPy = parsePythonTraceback(source.stackTrace);
      if (parsedPy) {
        errorType = parsedPy.errorType;
        message = parsedPy.errorMessage;
        topFrames = parsedPy.frames;
      }
    }
  }

  // 2. Select the most relevant application frame (skip node_modules/internal)
  const appFrames = topFrames.filter((f) => !f.isExternal);
  const relevantFrame = appFrames[0] || topFrames[0];

  // 3. Normalize the file path (keep relative basename/subpath, strip absolute prefix like /Users/...)
  let frameIdentifier = '';
  if (relevantFrame) {
    const cleanPath = relevantFrame.file.replace(/^[/\\](?:Users|home|app)[/\\][^/\\]+[/\\]?/, '');
    frameIdentifier = `${cleanPath}:${relevantFrame.functionName || 'anon'}`;
  }

  // 4. Normalize message
  const normalizedMsg = normalizeErrorMessage(message);

  // 5. Build canonical fingerprint string
  const canonical = [
    source.triggerType || 'UNKNOWN',
    errorType,
    frameIdentifier,
    normalizedMsg,
    source.exitCode !== undefined && source.exitCode !== null ? `exit:${source.exitCode}` : '',
  ]
    .filter(Boolean)
    .join('|');

  hash.update(canonical);
  return hash.digest('hex').substring(0, 32); // 32-char hex fingerprint
}
