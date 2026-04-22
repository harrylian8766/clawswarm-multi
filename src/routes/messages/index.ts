import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/groups/:groupId/messages', async (request) => {
    const { groupId } = request.params as { groupId: string };
    return { groupId, messages: [], message: 'Messages list - implementation pending' };
  });

  app.post('/groups/:groupId/messages', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const body = request.body as any;
    reply.code(201).send({ groupId, message: body, status: 'pending' });
  });

  app.get('/groups/:groupId/messages/stream', async (request, reply) => {
    // SSE 流式推送
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write('data: {"status":"connected","message":"SSE stream - implementation pending"}\n\n');
    // TODO: 实现真实的 SSE 推送
  });
};
