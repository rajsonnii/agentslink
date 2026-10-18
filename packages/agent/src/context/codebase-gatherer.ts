import fs from 'node:fs';
import path from 'node:path';
import type { Incident } from '@slink/shared';
import { parseNodeStackTrace, parsePythonTraceback } from '@slink/shared';

export interface CodeSnippet {
  filePath: string;
  relativeFilePath: string;
  startLine: number;
  endLine: number;
  highlightLine?: number;
  content: string;
  fullFileContent: string;
}

export interface GatheredContext {
  snippets: CodeSnippet[];
  relatedTestFiles: string[];
}

export class CodebaseGatherer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  public gatherContextForIncident(incident: Incident): GatheredContext {
    const snippets: CodeSnippet[] = [];
    const relatedTestFiles: string[] = [];

    // Extract file paths & lines from stack trace
    const targetLocations: Array<{ file: string; line?: number }> = [];

    if (incident.stackTrace) {
      const nodeTrace = parseNodeStackTrace(incident.stackTrace);
      if (nodeTrace) {
        for (const frame of nodeTrace.frames) {
          if (!frame.isExternal && frame.file) {
            targetLocations.push({ file: frame.file, line: frame.line });
          }
        }
      }

      const pyTrace = parsePythonTraceback(incident.stackTrace);
      if (pyTrace) {
        for (const frame of pyTrace.frames) {
          if (!frame.isExternal && frame.file) {
            targetLocations.push({ file: frame.file, line: frame.line });
          }
        }
      }
    }

    // Read matching source files
    for (const loc of targetLocations) {
      const resolved = this.resolveFilePath(loc.file);
      if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        try {
          const content = fs.readFileSync(resolved, 'utf8');
          const lines = content.split('\n');
          const targetLine = loc.line || 1;
          const startLine = Math.max(1, targetLine - 25);
          const endLine = Math.min(lines.length, targetLine + 25);
          const snippetContent = lines.slice(startLine - 1, endLine).join('\n');

          const relPath = path.relative(this.projectRoot, resolved);
          snippets.push({
            filePath: resolved,
            relativeFilePath: relPath,
            startLine,
            endLine,
            highlightLine: targetLine,
            content: snippetContent,
            fullFileContent: content,
          });

          // Check for nearby test files
          const tests = this.findNearbyTests(resolved);
          relatedTestFiles.push(...tests);
        } catch {}
      }
    }

    return {
      snippets,
      relatedTestFiles: Array.from(new Set(relatedTestFiles)),
    };
  }

  private resolveFilePath(rawPath: string): string | null {
    if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) {
      return rawPath;
    }
    const relativeToRoot = path.join(this.projectRoot, rawPath);
    if (fs.existsSync(relativeToRoot)) {
      return relativeToRoot;
    }
    return null;
  }

  private findNearbyTests(sourceFilePath: string): string[] {
    const dir = path.dirname(sourceFilePath);
    const parsed = path.parse(sourceFilePath);
    const candidates = [
      path.join(dir, `${parsed.name}.test${parsed.ext}`),
      path.join(dir, `${parsed.name}.spec${parsed.ext}`),
      path.join(dir, '__tests__', `${parsed.name}.test${parsed.ext}`),
      path.join(dir, 'tests', `test_${parsed.name}${parsed.ext}`),
    ];

    return candidates.filter((c) => fs.existsSync(c)).map((c) => path.relative(this.projectRoot, c));
  }
}
