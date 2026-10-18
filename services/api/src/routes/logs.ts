import type { FastifyPluginAsync } from 'fastify';
import type { LogBatch, ProcessExitPayload } from '@slink/shared';
import { LogBatchSchema, ProcessExitSchema } from '@slink/shared';
import { globalIncidentManager } from '../engine/incident-manager.js';

export const logsPlugin: FastifyPluginAsync = async (fastify) => {
  // HTTP POST /api/v1/logs/batch
  fastify.post('/api/v1/logs/batch', async (request, reply) => {
    const parseResult = LogBatchSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid log batch format',
        details: parseResult.error.format(),
      });
    }

    const batch = parseResult.data as LogBatch;
    const incidents = await globalIncidentManager.handleLogBatch(batch);

    return reply.status(200).send({
      success: true,
      received: batch.entries.length,
      incidentsTriggered: incidents.length,
    });
  });

  // HTTP POST /api/v1/logs/exit
  fastify.post('/api/v1/logs/exit', async (request, reply) => {
    const parseResult = ProcessExitSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid exit payload format',
        details: parseResult.error.format(),
      });
    }

    const payload = parseResult.data as ProcessExitPayload;
    const incident = await globalIncidentManager.handleProcessExit(payload);

    return reply.status(200).send({
      success: true,
      incident: incident ? { id: incident.id, title: incident.title } : null,
    });
  });

  // WebSocket /ws/logs
  fastify.get('/ws/logs', { websocket: true }, (socket, req) => {
    let currentSessionId: string | null = null;
    let currentProjectId: string | null = null;

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'SESSION_START') {
          currentSessionId = message.sessionId;
          currentProjectId = message.projectId;
          socket.send(JSON.stringify({ type: 'ACK_SESSION', sessionId: currentSessionId }));
          return;
        }

        if (message.type === 'LOG_BATCH') {
          const batch = message.payload as LogBatch;
          const incidents = await globalIncidentManager.handleLogBatch(batch);
          socket.send(
            JSON.stringify({
              type: 'ACK_BATCH',
              count: batch.entries.length,
              incidents: incidents.map((i) => i.id),
            })
          );
          return;
        }

        if (message.type === 'PROCESS_EXIT') {
          const payload = message.payload as ProcessExitPayload;
          const incident = await globalIncidentManager.handleProcessExit(payload);
          socket.send(
            JSON.stringify({
              type: 'ACK_EXIT',
              incidentId: incident?.id,
            })
          );
          return;
        }
      } catch (err: any) {
        socket.send(JSON.stringify({ type: 'ERROR', error: err.message }));
      }
    });
  });
};
