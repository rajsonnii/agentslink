import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import type { LogStreamer } from '../streamer/log-streamer.js';

export interface ProcessRunnerResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export function runMonitoredProcess(
  command: string,
  streamer: LogStreamer,
  cwd: string = process.cwd()
): Promise<ProcessRunnerResult> {
  return new Promise((resolve) => {
    // Spawn child process with shell support
    const child: ChildProcess = spawn(command, {
      shell: true,
      cwd,
      env: {
        ...process.env,
        FORCE_COLOR: '1', // Preserves terminal color formatting
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const childPid = child.pid;

    // Stream and intercept stdout
    if (child.stdout) {
      const rlStdout = readline.createInterface({ input: child.stdout, terminal: false });
      rlStdout.on('line', (line) => {
        // Echo directly to developer's console
        process.stdout.write(line + '\n');
        // Ship to Slink log streamer
        streamer.appendLog('stdout', line, line, childPid);
      });
    }

    // Stream and intercept stderr
    if (child.stderr) {
      const rlStderr = readline.createInterface({ input: child.stderr, terminal: false });
      rlStderr.on('line', (line) => {
        // Echo directly to developer's console
        process.stderr.write(line + '\n');
        // Ship to Slink log streamer
        streamer.appendLog('stderr', line, line, childPid);
      });
    }

    // Forward signals gracefully
    const handleSignal = (sig: NodeJS.Signals) => {
      if (child.pid && !child.killed) {
        child.kill(sig);
      }
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    child.on('close', async (code, signal) => {
      await streamer.notifyExit(code, signal);
      resolve({ code, signal });
    });

    child.on('error', async (err) => {
      streamer.appendLog('system', `Process error: ${err.message}`, err.stack, childPid);
      await streamer.notifyExit(1, null);
      resolve({ code: 1, signal: null });
    });
  });
}
