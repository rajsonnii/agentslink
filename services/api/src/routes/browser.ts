import type { FastifyPluginAsync } from 'fastify';
import type { BrowserCheckEvidence } from '@slink/shared';
import { globalIncidentManager } from '../engine/incident-manager.js';

export const browserPlugin: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/browser/report
  fastify.post('/api/v1/browser/report', async (request, reply) => {
    const evidence = request.body as BrowserCheckEvidence;

    if (!evidence || !evidence.projectId || !evidence.targetUrl) {
      return reply.status(400).send({ error: 'Missing projectId or targetUrl in browser report' });
    }

    const incident = await globalIncidentManager.handleBrowserEvidence(evidence);

    return reply.status(200).send({
      success: true,
      status: evidence.status,
      incident: incident ? { id: incident.id, title: incident.title } : null,
    });
  });
};
