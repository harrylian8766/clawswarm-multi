/**
 * Group 路由 - 创建/查询/成员管理
 * Phase 1: 多 Agent 分组管理
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const groupRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/groups - 创建群组
  app.post('/groups', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      name: string;
      description?: string;
      created_by: string;
      max_members?: number;
      allow_byoa?: boolean;
      coordinator_model?: string;
      members?: Array<{ member_type: string; member_id: string; role?: string; capabilities?: string[] }>;
    };

    if (!body.name || !body.created_by) {
      return reply.status(400).send({ error: 'name and created_by are required' });
    }

    const [group] = await app.db('chat_groups')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        created_by: body.created_by,
        max_members: body.max_members || 500,
        allow_byoa: body.allow_byoa !== false,
        coordinator_model: body.coordinator_model,
      })
      .returning('*');

    // 添加创建者为成员
    await app.db('group_members').insert({
      tenant_id: tenantId,
      group_id: group.id,
      member_type: 'human',
      member_id: body.created_by,
      role: 'owner',
    });

    // 批量添加成员
    if (body.members?.length) {
      const memberRows = body.members.map((m) => ({
        tenant_id: tenantId,
        group_id: group.id,
        member_type: m.member_type,
        member_id: m.member_id,
        role: m.role || 'member',
        capabilities: JSON.stringify(m.capabilities || []),
      }));
      await app.db('group_members').insert(memberRows);
    }

    return reply.status(201).send({ group });
  });

  // GET /api/v1/groups - 列出群组
  app.get('/groups', async (request) => {
    const tenantId = (request as any).tenantId;
    const groups = await app.db('chat_groups')
      .where({ tenant_id: tenantId })
      .select('*')
      .orderBy('created_at', 'desc');

    return { groups };
  });

  // GET /api/v1/groups/:id - 群组详情（含成员）
  app.get<{ Params: { id: string } }>('/groups/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;

    const group = await app.db('chat_groups')
      .where({ tenant_id: tenantId, id })
      .first();
    if (!group) return { error: 'Group not found' };

    const members = await app.db('group_members')
      .where({ tenant_id: tenantId, group_id: id })
      .select('*');

    return {
      group,
      members: members.map((m) => ({
        ...m,
        capabilities: typeof m.capabilities === 'string' ? JSON.parse(m.capabilities) : m.capabilities,
      })),
    };
  });

  // POST /api/v1/groups/:id/members - 添加成员
  app.post<{ Params: { id: string } }>('/groups/:id/members', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id: groupId } = request.params;
    const body = request.body as {
      members: Array<{ member_type: string; member_id: string; role?: string; capabilities?: string[] }>;
    };

    if (!body.members?.length) {
      return reply.status(400).send({ error: 'members array is required' });
    }

    const rows = body.members.map((m) => ({
      tenant_id: tenantId,
      group_id: groupId,
      member_type: m.member_type,
      member_id: m.member_id,
      role: m.role || 'member',
      capabilities: JSON.stringify(m.capabilities || []),
    }));

    await app.db('group_members').insert(rows);
    return { status: 'ok', added: rows.length };
  });

  // DELETE /api/v1/groups/:id - 删除群组
  app.delete<{ Params: { id: string } }>('/groups/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;
    await app.db('chat_groups').where({ tenant_id: tenantId, id }).del();
    return { status: 'ok' };
  });
};
