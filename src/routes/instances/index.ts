/**
 * Agent Instance 路由 - 注册/心跳/查询
 * Phase 1: Agent 生命周期管理
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const instanceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/instances - 注册新 Agent
  app.post('/instances', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      name: string;
      openclaw_instance_id: string;
      endpoint: string;
      capabilities?: string[];
      tools?: string[];
      supported_models?: string[];
      deployment_location?: string;
      memory_context?: string;
    };

    if (!body.name || !body.openclaw_instance_id || !body.endpoint) {
      return reply.status(400).send({ error: 'name, openclaw_instance_id, endpoint are required' });
    }

    const [instance] = await app.db('agent_instances')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        openclaw_instance_id: body.openclaw_instance_id,
        endpoint: body.endpoint,
        capabilities: JSON.stringify(body.capabilities || []),
        tools: JSON.stringify(body.tools || []),
        supported_models: JSON.stringify(body.supported_models || []),
        deployment_location: body.deployment_location,
        memory_context: body.memory_context,
        status: 'active',
        last_heartbeat: new Date(),
      })
      .returning('*');

    return reply.status(201).send({ instance });
  });

  // GET /api/v1/instances - 列出租户的所有 Agent
  app.get('/instances', async (request) => {
    const tenantId = (request as any).tenantId;
    const instances = await app.db('agent_instances')
      .where({ tenant_id: tenantId })
      .select('*')
      .orderBy('created_at', 'desc');

    // 解析 JSON 字段
    return {
      instances: instances.map((i) => ({
        ...i,
        capabilities: typeof i.capabilities === 'string' ? JSON.parse(i.capabilities) : i.capabilities,
        tools: typeof i.tools === 'string' ? JSON.parse(i.tools) : i.tools,
        supported_models: typeof i.supported_models === 'string' ? JSON.parse(i.supported_models) : i.supported_models,
      })),
    };
  });

  // GET /api/v1/instances/:id - 查询单个 Agent
  app.get<{ Params: { id: string } }>('/instances/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;
    const instance = await app.db('agent_instances')
      .where({ tenant_id: tenantId, id })
      .first();

    if (!instance) return { error: 'Instance not found' };
    return {
      ...instance,
      capabilities: typeof instance.capabilities === 'string' ? JSON.parse(instance.capabilities) : instance.capabilities,
      tools: typeof instance.tools === 'string' ? JSON.parse(instance.tools) : instance.tools,
      supported_models: typeof instance.supported_models === 'string' ? JSON.parse(instance.supported_models) : instance.supported_models,
    };
  });

  // POST /api/v1/instances/:id/heartbeat - 心跳
  app.post<{ Params: { id: string } }>('/instances/:id/heartbeat', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;
    const body = request.body as { capabilities?: string[]; tools?: string[] } | undefined;

    const updated = await app.db('agent_instances')
      .where({ tenant_id: tenantId, id })
      .update({
        last_heartbeat: new Date(),
        status: 'active',
        ...(body?.capabilities ? { capabilities: JSON.stringify(body.capabilities) } : {}),
        ...(body?.tools ? { tools: JSON.stringify(body.tools) } : {}),
      })
      .returning('*');

    if (!updated.length) return reply.status(404).send({ error: 'Instance not found' });
    return { status: 'ok', instance: updated[0] };
  });

  // DELETE /api/v1/instances/:id - 注销 Agent
  app.delete<{ Params: { id: string } }>('/instances/:id', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;

    const deleted = await app.db('agent_instances')
      .where({ tenant_id: tenantId, id })
      .update({ status: 'offline' })
      .returning('*');

    if (!deleted.length) return reply.status(404).send({ error: 'Instance not found' });
    return { status: 'ok', message: 'Instance offline' };
  });

  // POST /api/v1/instances/byoa - BYOA 自注册（Agent 自己注册）
  app.post('/instances/byoa', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      name: string;
      openclaw_instance_id: string;
      endpoint: string;
      capabilities?: string[];
      tools?: string[];
      supported_models?: string[];
      deployment_location?: string;
      memory_context?: string;
    };

    if (!body.name || !body.openclaw_instance_id) {
      return reply.status(400).send({ error: 'name and openclaw_instance_id are required' });
    }

    // 检查是否已存在同名 Agent，存在则更新
    const existing = await app.db('agent_instances')
      .where({ tenant_id: tenantId, openclaw_instance_id: body.openclaw_instance_id })
      .first();

    if (existing) {
      const [updated] = await app.db('agent_instances')
        .where({ id: existing.id })
        .update({
          name: body.name,
          endpoint: body.endpoint || existing.endpoint,
          capabilities: JSON.stringify(body.capabilities || (typeof existing.capabilities === 'string' ? JSON.parse(existing.capabilities) : existing.capabilities)),
          tools: JSON.stringify(body.tools || (typeof existing.tools === 'string' ? JSON.parse(existing.tools) : existing.tools)),
          supported_models: JSON.stringify(body.supported_models || (typeof existing.supported_models === 'string' ? JSON.parse(existing.supported_models) : existing.supported_models)),
          status: 'active',
          last_heartbeat: new Date(),
        }).returning('*');
      return { instance: updated, action: 'updated' };
    }

    // 新注册
    const [instance] = await app.db('agent_instances')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        openclaw_instance_id: body.openclaw_instance_id,
        endpoint: body.endpoint || 'auto',
        capabilities: JSON.stringify(body.capabilities || []),
        tools: JSON.stringify(body.tools || []),
        supported_models: JSON.stringify(body.supported_models || []),
        deployment_location: body.deployment_location,
        memory_context: body.memory_context,
        status: 'active',
        last_heartbeat: new Date(),
      }).returning('*');

    return reply.status(201).send({ instance, action: 'created' });
  });
};
