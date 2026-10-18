import type { FastifyPluginAsync } from 'fastify';
import type { IncidentStatus } from '@slink/shared';
import { globalIncidentStore } from '../store/incident-store.js';
import { globalIncidentManager } from '../engine/incident-manager.js';

export const incidentsPlugin: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/incidents
  fastify.get('/api/v1/incidents', async (request, reply) => {
    const { projectId, status } = request.query as { projectId?: string; status?: IncidentStatus };
    const incidents = globalIncidentStore.list({ projectId, status });

    return reply.status(200).send({
      success: true,
      count: incidents.length,
      incidents,
    });
  });

  // GET /api/v1/incidents/:id
  fastify.get('/api/v1/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = globalIncidentStore.getById(id);

    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    return reply.status(200).send({
      success: true,
      incident,
    });
  });

  // PATCH /api/v1/incidents/:id/status
  fastify.patch('/api/v1/incidents/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: IncidentStatus };

    const updated = globalIncidentManager.updateStatus(id, status);
    if (!updated) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    return reply.status(200).send({
      success: true,
      incident: updated,
    });
  });

  // POST /api/v1/incidents/:id/heal
  fastify.post('/api/v1/incidents/:id/heal', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = globalIncidentStore.getById(id);

    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    const { RepairOrchestrator } = await import('@slink/agent');
    const orchestrator = new RepairOrchestrator();
    const repairResult = await orchestrator.attemptRepair(incident);

    // Persist updated incident
    globalIncidentStore.save(incident);

    return reply.status(200).send({
      success: repairResult.success,
      incident,
      repairResult,
    });
  });
};
