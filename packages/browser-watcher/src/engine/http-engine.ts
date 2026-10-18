import { randomUUID } from 'node:crypto';
import type {
  BrowserCheckEvidence,
  BrowserCheckStatus,
  ConsoleErrorItem,
  FailedRequestItem,
  DomErrorItem,
} from '@slink/shared';
import type { BrowserEngine, BrowserCheckOptions } from './types.js';

export class HttpBrowserEngine implements BrowserEngine {
  public async runCheck(options: BrowserCheckOptions): Promise<BrowserCheckEvidence> {
    const startTime = Date.now();
    const consoleErrors: ConsoleErrorItem[] = [];
    const failedRequests: FailedRequestItem[] = [];
    const domErrors: DomErrorItem[] = [];

    let httpStatus = 0;
    let pageTitle = '';
    let bodyText = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

      const res = await fetch(options.targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Agent-Slink-BrowserWatcher/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);
      httpStatus = res.status;
      bodyText = await res.text();

      // Extract title from HTML
      const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        pageTitle = titleMatch[1].trim();
      }

      // Check HTTP error status
      if (httpStatus >= 400) {
        failedRequests.push({
          url: options.targetUrl,
          method: 'GET',
          status: httpStatus,
          statusText: res.statusText,
          failureText: `HTTP error response: ${httpStatus} ${res.statusText}`,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      }

      // Check for error traces or crash indications in HTML
      if (
        bodyText.includes('500 Internal Server Error') ||
        bodyText.includes('Unhandled Exception') ||
        bodyText.includes('TypeError:') ||
        bodyText.includes('Traceback (most recent call last):')
      ) {
        domErrors.push({
          message: 'Error signature or crash page detected in HTML body',
          snippet: bodyText.substring(0, 300).replace(/\s+/g, ' ').trim(),
        });
      }
    } catch (err: any) {
      httpStatus = 503;
      consoleErrors.push({
        type: 'network_failure',
        text: err.name === 'AbortError' ? 'Request timed out' : `Connection refused: ${err.message}`,
        timestamp: Date.now(),
      });
    }

    const responseTimeMs = Date.now() - startTime;
    let status: BrowserCheckStatus = 'HEALTHY';

    if (httpStatus >= 500 || domErrors.length > 0) {
      status = 'DOWN';
    } else if (httpStatus >= 400 || consoleErrors.length > 0 || failedRequests.length > 0) {
      status = 'DEGRADED';
    }

    return {
      checkId: `chk_${randomUUID().substring(0, 10)}`,
      projectId: options.projectId,
      targetUrl: options.targetUrl,
      status,
      httpStatus,
      responseTimeMs,
      consoleErrors,
      failedRequests,
      domErrors,
      pageTitle,
      timestamp: Date.now(),
    };
  }
}
