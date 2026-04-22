/**
 * Thread 路由 - 会话线程管理
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const threadRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/threads - 创建线程
  app.post('/threads', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      group_id: string;
      title?: string;
      creator_id: string;
    };

    if (!body.group_id || !body.creator_id) {
      return reply.status(400).send({ error: 'group_id and creator_id are required' });
    }

    const [thread] = await app.db('conversation_threads')
      .insert({
        tenant_id: tenantId,
        group_id: body.group_id,
        title: body.title,
        creator_id: body.creator_id,
      })
      .returning('*');

    return reply.status(201).send({ thread });
  });

  // GET /api/v1/threads?group_id=xxx - 列出线程
  app.get('/threads', async (request) => {
    const tenantId = (request as any).tenantId;
    const { group_id } = request.query as { group_id?: string };

    let query = app.db('conversation_threads')
      .where({ tenant_id: tenantId });

    if (group_id) query = query.where({ group_id });

    const threads = await query.orderBy('created_at', 'desc').select('*');
    return { threads };
  });

  // GET /api/v1/threads/:id - 线程详情（含消息）
  app.get<{ Params: { id: string } }>('/threads/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;

    const thread = await app.db('conversation_threads')
      .where({ tenant_id: tenantId, id })
      .first();
    if (!thread) return { error: 'Thread not found' };

    const messages = await app.db('chat_messages')
      .where({ tenant_id: tenantId, thread_id: id })
      .orderBy('created_at', 'asc')
      .select('*');

    return {
      thread,
      messages: messages.map((m) => ({
        ...m,
        mentioned_members: typeof m.mentioned_members === 'string' ? JSON.parse(m.mentioned_members) : m.mentioned_members,
      })),
    };
  });
};
