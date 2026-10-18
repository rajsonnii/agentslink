import type { BrowserCheckEvidence } from '@slink/shared';

export interface BrowserCheckOptions {
  projectId: string;
  targetUrl: string;
  timeoutMs?: number;
  captureScreenshot?: boolean;
}

export interface BrowserEngine {
  runCheck(options: BrowserCheckOptions): Promise<BrowserCheckEvidence>;
}
