import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitCommitContext } from '@slink/shared';

const execFileAsync = promisify(execFile);

export class GitInspector {
  private repoDir: string;

  constructor(repoDir: string = process.cwd()) {
    this.repoDir = repoDir;
  }

  public async getRecentCommits(limit: number = 5): Promise<GitCommitContext[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', `-n`, limit.toString(), '--pretty=format:%H|%h|%an|%ad|%s', '--date=iso'],
        { cwd: this.repoDir }
      );

      const lines = stdout.trim().split('\n').filter(Boolean);
      const commits: GitCommitContext[] = [];

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          const commitSha = parts[0]!;
          const shortSha = parts[1]!;
          const author = parts[2]!;
          const date = parts[3]!;
          const message = parts.slice(4).join('|');

          const changedFiles = await this.getCommitChangedFiles(commitSha);

          commits.push({
            commitSha,
            shortSha,
            author,
            date,
            message,
            changedFiles,
          });
        }
      }

      return commits;
    } catch {
      return [];
    }
  }

  public async getCommitChangedFiles(commitSha: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['diff-tree', '--no-commit-id', '--name-only', '-r', commitSha],
        { cwd: this.repoDir }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  public async getRecentDiff(commitCount: number = 1): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['diff', `HEAD~${commitCount}`, 'HEAD'],
        { cwd: this.repoDir }
      );
      return stdout.slice(0, 10000); // Bounded size
    } catch {
      return '';
    }
  }

  public async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.repoDir,
      });
      return stdout.trim() || 'main';
    } catch {
      return 'main';
    }
  }
}
