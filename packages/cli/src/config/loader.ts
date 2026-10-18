import fs from 'node:fs';
import path from 'node:path';

export interface SlinkConfig {
  projectId: string;
  apiUrl: string;
  apiKey?: string;
  autoHeal?: boolean;
}

const DEFAULT_API_URL = 'http://localhost:4000';

export function loadSlinkConfig(startDir: string = process.cwd()): SlinkConfig {
  let currentDir = path.resolve(startDir);
  let configFile: string | null = null;

  while (currentDir !== path.dirname(currentDir)) {
    const candidate = path.join(currentDir, '.slink.json');
    if (fs.existsSync(candidate)) {
      configFile = candidate;
      break;
    }
    currentDir = path.dirname(currentDir);
  }

  let fileConfig: Partial<SlinkConfig> = {};
  if (configFile) {
    try {
      const content = fs.readFileSync(configFile, 'utf8');
      fileConfig = JSON.parse(content);
    } catch (err) {
      console.warn(`[slink] Warning: could not parse configuration file at ${configFile}`);
    }
  }

  const projectId =
    process.env['SLINK_PROJECT_ID'] ||
    fileConfig.projectId ||
    'default-project';

  const apiUrl =
    process.env['SLINK_API_URL'] ||
    fileConfig.apiUrl ||
    DEFAULT_API_URL;

  const apiKey =
    process.env['SLINK_API_KEY'] ||
    fileConfig.apiKey;

  return {
    projectId,
    apiUrl,
    apiKey,
    autoHeal: fileConfig.autoHeal ?? true,
  };
}

export function saveSlinkConfig(config: SlinkConfig, targetDir: string = process.cwd()): string {
  const filePath = path.join(targetDir, '.slink.json');
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
  return filePath;
}
