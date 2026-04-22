/**
 * Members 路由 - 成员查询
 * 注意: 添加成员由 groups/:id/members 处理
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const memberRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // GET /api/v1/members?group_id=xxx - 查询群组成员
  app.get('/members', async (request) => {
    const tenantId = (request as any).tenantId;
    const { group_id } = request.query as { group_id?: string };

    if (!group_id) {
      return { error: 'group_id query parameter is required' };
    }

    const members = await app.db('group_members')
      .where({ tenant_id: tenantId, group_id })
      .select('*');

    return {
      members: members.map((m) => ({
        ...m,
        capabilities: typeof m.capabilities === 'string' ? JSON.parse(m.capabilities) : m.capabilities,
      })),
    };
  });

  // DELETE /api/v1/members/:id - 移除成员
  app.delete<{ Params: { id: string } }>('/members/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;

    await app.db('group_members')
      .where({ tenant_id: tenantId, id })
      .del();

    return { status: 'ok' };
  });
};
