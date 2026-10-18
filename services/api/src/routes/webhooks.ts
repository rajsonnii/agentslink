import type { FastifyPluginAsync } from 'fastify';
import { globalIncidentStore } from '../store/incident-store.js';

export const webhooksPlugin: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/webhooks/github
  fastify.post('/api/v1/webhooks/github', async (request, reply) => {
    const event = request.headers['x-github-event'] as string;
    const payload = request.body as any;

    fastify.log.info({ event }, 'Received GitHub webhook');

    if (event === 'deployment_status') {
      const state = payload?.deployment_status?.state;
      const environment = payload?.deployment?.environment;

      // When a deployment succeeds (e.g. production/staging), notify that post-deploy checks can run
      if (state === 'success') {
        fastify.log.info({ environment }, 'Deployment succeeded, ready for post-deploy browser re-verification');
      }
    }

    if (event === 'pull_request') {
      const action = payload?.action;
      const prNumber = payload?.pull_request?.number;

      if (action === 'closed' && payload?.pull_request?.merged) {
        // Find incident associated with this PR
        const allIncidents = globalIncidentStore.list();
        const related = allIncidents.find((inc) => inc.pullRequest?.number === prNumber);
        if (related) {
          fastify.log.info({ prNumber, incidentId: related.id }, 'PR merged, awaiting deployment to re-verify');
        }
      }
    }

    return reply.status(200).send({ received: true });
  });
};
