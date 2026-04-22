import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

export const tenantRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/tenants — 创建租户
  app.post('/tenants', async (request, reply) => {
    const { name } = request.body as { name: string };
    const apiKey = `cs_${crypto.randomBytes(16).toString('hex')}`;

    const [tenant] = await app.db('tenants')
      .insert({ name, api_key: apiKey })
      .returning('*');

    return reply.status(201).send({ tenant });
  });

  // GET /api/v1/tenants/:id — 获取租户
  app.get<{ Params: { id: string } }>('/tenants/:id', async (request) => {
    const tenant = await app.db('tenants')
      .where({ id: request.params.id })
      .first();
    if (!tenant) return { error: 'Tenant not found' };
    return { tenant };
  });

  // POST /api/v1/tenants/:id/apikey — 重置 API Key
  app.post<{ Params: { id: string } }>('/tenants/:id/apikey', async (request) => {
    const apiKey = `cs_${crypto.randomBytes(16).toString('hex')}`;
    const [tenant] = await app.db('tenants')
      .where({ id: request.params.id })
      .update({ api_key: apiKey, updated_at: new Date() })
      .returning('*');
    if (!tenant) return { error: 'Tenant not found' };
    return { tenant };
  });
};
