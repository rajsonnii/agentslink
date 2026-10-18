/**
 * Normalizes error messages and stack traces to ensure deterministic deduplication
 * by stripping dynamic noise (timestamps, memory addresses, UUIDs, temporary paths).
 */
export function normalizeErrorMessage(message: string): string {
  if (!message) return '';

  return message
    // Normalize ISO timestamps (e.g. 2026-10-18T16:21:30.123Z)
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, '<TIMESTAMP>')
    // Normalize common time formats (e.g. 16:21:30 or [16:21:30])
    .replace(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g, '<TIME>')
    // Normalize UUIDs (v4 etc)
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '<UUID>')
    // Normalize hexadecimal addresses (e.g. 0x7fff5fbff820)
    .replace(/\b0x[0-9a-fA-F]{4,16}\b/g, '<HEX>')
    // Normalize IP addresses and localhost ports (e.g. localhost:3000, 127.0.0.1:8080)
    .replace(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d{2,5}/g, 'localhost:<PORT>')
    // Normalize standalone numbers (e.g. line numbers or random tokens when large)
    .replace(/\b\d{6,}\b/g, '<ID>')
    // Trim and collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
