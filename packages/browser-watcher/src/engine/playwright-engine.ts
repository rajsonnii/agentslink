import { randomUUID } from 'node:crypto';
import type {
  BrowserCheckEvidence,
  BrowserCheckStatus,
  ConsoleErrorItem,
  FailedRequestItem,
  DomErrorItem,
} from '@slink/shared';
import type { BrowserEngine, BrowserCheckOptions } from './types.js';

export class PlaywrightBrowserEngine implements BrowserEngine {
  public async runCheck(options: BrowserCheckOptions): Promise<BrowserCheckEvidence> {
    const { chromium } = await import('playwright');
    const startTime = Date.now();
    const consoleErrors: ConsoleErrorItem[] = [];
    const failedRequests: FailedRequestItem[] = [];
    const domErrors: DomErrorItem[] = [];

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      // Listen for console errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push({
            type: msg.type(),
            text: msg.text(),
            location: msg.location(),
            timestamp: Date.now(),
          });
        }
      });

      // Listen for uncaught exceptions in page
      page.on('pageerror', (err) => {
        consoleErrors.push({
          type: 'uncaught_exception',
          text: err.message,
          timestamp: Date.now(),
        });
      });

      // Listen for failed network requests
      page.on('requestfailed', (req) => {
        const failure = req.failure();
        failedRequests.push({
          url: req.url(),
          method: req.method(),
          status: 0,
          statusText: 'FAILED',
          failureText: failure?.errorText || 'Network request aborted',
          durationMs: 0,
          timestamp: Date.now(),
        });
      });

      // Listen for 4xx/5xx responses
      page.on('response', (res) => {
        if (res.status() >= 400) {
          failedRequests.push({
            url: res.url(),
            method: res.request().method(),
            status: res.status(),
            statusText: res.statusText(),
            durationMs: 0,
            timestamp: Date.now(),
          });
        }
      });

      let httpStatus = 200;
      let pageTitle = '';
      try {
        const response = await page.goto(options.targetUrl, {
          timeout: options.timeoutMs || 15000,
          waitUntil: 'networkidle',
        });
        httpStatus = response?.status() || 200;
        pageTitle = await page.title();
      } catch (navErr: any) {
        httpStatus = 500;
        consoleErrors.push({
          type: 'navigation_error',
          text: navErr.message,
          timestamp: Date.now(),
        });
      }

      // Check DOM for common crash or error signatures
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText) {
        if (
          bodyText.includes('500 Internal Server Error') ||
          bodyText.includes('Unhandled Exception') ||
          bodyText.includes('Application Error')
        ) {
          domErrors.push({
            message: 'Application crash screen detected in DOM',
            snippet: bodyText.substring(0, 200).trim(),
          });
        }
      }

      // Capture screenshot if requested or if errors were found
      let screenshotBase64: string | undefined;
      const hasErrors = httpStatus >= 400 || consoleErrors.length > 0 || domErrors.length > 0;
      if (options.captureScreenshot || hasErrors) {
        try {
          const buffer = await page.screenshot({ fullPage: false });
          screenshotBase64 = buffer.toString('base64');
        } catch {}
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
        screenshotBase64,
        pageTitle,
        timestamp: Date.now(),
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}
