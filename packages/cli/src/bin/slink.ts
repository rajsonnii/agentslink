#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { loadSlinkConfig, saveSlinkConfig } from '../config/loader.js';
import { LogStreamer } from '../streamer/log-streamer.js';
import { runMonitoredProcess } from '../runner/process-runner.js';

const program = new Command();

program
  .name('slink')
  .description('Agent Slink - Autonomous self-healing runtime monitor & log streamer')
  .version('0.1.0');

program
  .command('run')
  .description('Run and monitor an application command (e.g. slink run -- npm start)')
  .allowUnknownOption(true)
  .helpOption(false)
  .action(async () => {
    // Collect all arguments following 'run' or '--'
    const rawArgs = process.argv.slice(2);
    const runIndex = rawArgs.indexOf('run');
    let commandArgs = rawArgs.slice(runIndex + 1);

    if (commandArgs[0] === '--') {
      commandArgs = commandArgs.slice(1);
    }

    if (commandArgs.length === 0) {
      console.error(pc.red('Error: No command specified to run.'));
      console.log(pc.yellow('Usage: slink run -- <your-command> (e.g. slink run -- npm run dev)'));
      process.exit(1);
    }

    const fullCommand = commandArgs.join(' ');
    const config = loadSlinkConfig();

    console.log(pc.cyan('🦎 Agent Slink active'));
    console.log(pc.dim(`  Project ID: ${config.projectId}`));
    console.log(pc.dim(`  Slink API:  ${config.apiUrl}`));
    console.log(pc.dim(`  Command:    ${fullCommand}`));
    console.log(pc.dim('--------------------------------------------------'));

    const streamer = new LogStreamer(config, fullCommand);
    const result = await runMonitoredProcess(fullCommand, streamer);

    if (result.code !== null && result.code !== 0) {
      console.log(pc.dim('--------------------------------------------------'));
      console.log(pc.red(`🦎 Agent Slink: Process exited with failure code ${result.code}`));
      process.exit(result.code);
    }
  });

program
  .command('init')
  .description('Initialize a Slink configuration (.slink.json) in this directory')
  .option('-p, --project <id>', 'Project ID', 'default-project')
  .option('-u, --url <url>', 'Slink API URL', 'http://localhost:4000')
  .action((options) => {
    const config = {
      projectId: options.project,
      apiUrl: options.url,
      autoHeal: true,
    };
    const savedPath = saveSlinkConfig(config);
    console.log(pc.green(`✔ Created Slink configuration at ${savedPath}`));
  });

program
  .command('status')
  .description('Check connectivity to Slink API and current configuration')
  .action(async () => {
    const config = loadSlinkConfig();
    console.log(pc.cyan('Agent Slink Configuration:'));
    console.log(`  Project: ${pc.bold(config.projectId)}`);
    console.log(`  API URL: ${pc.bold(config.apiUrl)}`);

    try {
      const res = await fetch(`${config.apiUrl}/health`, { method: 'GET' });
      if (res.ok) {
        console.log(pc.green('✔ Slink API is online and reachable.'));
      } else {
        console.log(pc.yellow(`⚠ Slink API returned status ${res.status}.`));
      }
    } catch {
      console.log(pc.red(`✖ Could not connect to Slink API at ${config.apiUrl}. Is the server running?`));
    }
  });

program.parse();
