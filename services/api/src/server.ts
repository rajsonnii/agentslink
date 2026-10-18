import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { logsPlugin } from './routes/logs.js';
import { incidentsPlugin } from './routes/incidents.js';
import { browserPlugin } from './routes/browser.js';
import { webhooksPlugin } from './routes/webhooks.js';

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
  });

  // Enable CORS for dashboard and local dev
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // Enable WebSockets
  await server.register(websocket);

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', service: 'agentslink-api', timestamp: Date.now() };
  });

  // Register domain plugins
  await server.register(logsPlugin);
  await server.register(incidentsPlugin);
  await server.register(browserPlugin);
  await server.register(webhooksPlugin);

  return server;
}
