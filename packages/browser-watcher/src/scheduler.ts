import type { BrowserCheckEvidence } from '@slink/shared';
import type { BrowserEngine, BrowserCheckOptions } from './engine/types.js';
import { HttpBrowserEngine } from './engine/http-engine.js';
import { PlaywrightBrowserEngine } from './engine/playwright-engine.js';

export interface WatcherConfig {
  apiUrl: string;
  projectId: string;
  targetUrl: string;
  intervalMs?: number;
  engine?: 'playwright' | 'http';
}

export class BrowserWatcherScheduler {
  private config: WatcherConfig;
  private engine: BrowserEngine;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: WatcherConfig) {
    this.config = config;
    this.engine = config.engine === 'playwright' ? new PlaywrightBrowserEngine() : new HttpBrowserEngine();
  }

  public async runOnce(): Promise<BrowserCheckEvidence> {
    const evidence = await this.engine.runCheck({
      projectId: this.config.projectId,
      targetUrl: this.config.targetUrl,
      captureScreenshot: true,
    });

    await this.reportToApi(evidence);
    return evidence;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const interval = this.config.intervalMs || 30000;

    // Run first check immediately
    this.runOnce().catch(() => {});

    this.timer = setInterval(() => {
      this.runOnce().catch(() => {});
    }, interval);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  private async reportToApi(evidence: BrowserCheckEvidence): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/v1/browser/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evidence),
      });
    } catch {
      // API may be temporarily unreachable
    }
  }
}
