import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const instanceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/instances
  app.get('/instances', async (request) => {
    const tenantId = (request as any).tenantId;
    return { tenantId, instances: [], message: 'Instances list - implementation pending' };
  });

  // POST /api/v1/instances — BYOA 注册（含能力声明）
  app.post('/instances', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as any;
    reply.code(201).send({
      tenantId,
      instance: {
        id: 'pending',
        ...body,
        status: 'active',
        message: 'Instance registration (BYOA) - implementation pending',
      },
    });
  });

  // GET /api/v1/instances/:id
  app.get('/instances/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { id, message: 'Instance detail - implementation pending' };
  });

  // DELETE /api/v1/instances/:id
  app.delete('/instances/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { id, message: 'Instance deregistration - implementation pending' };
  });

  // POST /api/v1/instances/:id/sync-agents
  app.post('/instances/:id/sync-agents', async (request) => {
    const { id } = request.params as { id: string };
    return { id, agents: [], message: 'Agent sync - implementation pending' };
  });

  // POST /api/v1/instances/:id/heartbeat
  app.post('/instances/:id/heartbeat', async (request) => {
    const { id } = request.params as { id: string };
    return { id, status: 'active', timestamp: new Date().toISOString() };
  });

  // PUT /api/v1/instances/:id/capabilities
  app.put('/instances/:id/capabilities', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return { id, capabilities: body, message: 'Capabilities update - implementation pending' };
  });
};
