import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const tenantRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/tenants — 创建租户
  app.post('/tenants', async (request, reply) => {
    const { name } = request.body as { name: string };
    // TODO: 实现
    reply.code(201).send({
      id: 'pending',
      name,
      api_key: 'pending-implementation',
      message: 'Tenant creation endpoint - implementation pending',
    });
  });

  // GET /api/v1/tenants/:id — 获取租户信息
  app.get('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: 实现
    reply.send({ id, message: 'Tenant info endpoint - implementation pending' });
  });

  // POST /api/v1/tenants/:id/apikey — 生成/重置 API Key
  app.post('/tenants/:id/apikey', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: 实现
    reply.send({ id, api_key: 'pending-implementation', message: 'API Key reset - implementation pending' });
  });
};
