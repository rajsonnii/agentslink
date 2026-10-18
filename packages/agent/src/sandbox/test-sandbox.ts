import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { SandboxVerificationResult, FileChange } from '@slink/shared';

const execAsync = promisify(exec);

export interface SandboxOptions {
  projectRoot: string;
  testCommand?: string;
  timeoutMs?: number;
}

export class TestSandbox {
  private projectRoot: string;
  private testCommand: string;
  private timeoutMs: number;

  constructor(options: SandboxOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.testCommand = options.testCommand || 'npm test';
    this.timeoutMs = options.timeoutMs || 45000;
  }

  public async verifyPatch(fileChanges: FileChange[]): Promise<SandboxVerificationResult> {
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slink-sandbox-'));
    const startTime = Date.now();

    try {
      // 1. Copy project into sandbox (shallow copy, symlinking node_modules for ultra-fast startup)
      this.cloneProjectToSandbox(this.projectRoot, sandboxDir);

      // 2. Apply proposed file changes to sandbox
      for (const change of fileChanges) {
        const destFile = path.join(sandboxDir, change.path);
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.writeFileSync(destFile, change.modifiedContent, 'utf8');
      }

      // 3. Execute test suite in isolated sandbox
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      try {
        const result = await execAsync(this.testCommand, {
          cwd: sandboxDir,
          timeout: this.timeoutMs,
          env: {
            ...process.env,
            CI: 'true',
            SLINK_SANDBOX: 'true',
          },
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        exitCode = err.code ?? 1;
        stdout = err.stdout ?? '';
        stderr = err.stderr ?? err.message;
      }

      const durationMs = Date.now() - startTime;
      const passed = exitCode === 0;

      return {
        passed,
        exitCode,
        stdout,
        stderr,
        durationMs,
      };
    } finally {
      // 4. Ensure sandbox is cleanly unmounted and destroyed
      try {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      } catch {}
    }
  }

  private cloneProjectToSandbox(sourceDir: string, destDir: string): void {
    // Copy all files and folders except node_modules, .git, dist
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'dist' || entry.name === '.turbo') {
        continue;
      }

      const srcPath = path.join(sourceDir, entry.name);
      const dstPath = path.join(destDir, entry.name);

      if (entry.name === 'node_modules') {
        // Symlink node_modules for instant access without copying gigabytes of files
        try {
          fs.symlinkSync(srcPath, dstPath, 'dir');
        } catch {
          // If symlink fails, ignore or copy package.json
        }
        continue;
      }

      if (entry.isDirectory()) {
        fs.cpSync(srcPath, dstPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }
}
