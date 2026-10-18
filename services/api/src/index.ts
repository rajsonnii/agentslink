import { createServer } from './server.js';

const PORT = parseInt(process.env['PORT'] || '4000', 10);
const HOST = process.env['HOST'] || '0.0.0.0';

async function start() {
  const server = await createServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`🦎 Slink API server running at http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Only start directly if this is the main module
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  start();
}

export { createServer };
