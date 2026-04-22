/**
 * Messages route - 核心消息路由
 * Phase 0 PoC: 通过 OpenClaw HTTP API 调用 agent
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CoordinatorMatcher } from '../../coordinator/matcher';

const matcher = new CoordinatorMatcher();

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/messages
  app.post('/messages', async (request, reply) => {
    const { message, group_id, thread_id, history } = request.body as {
      message: string;
      group_id?: string;
      thread_id?: string;
      history?: Array<{ role: string; content: string }>;
    };

    const tenantId = (request as any).tenantId || 'default';

    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    try {
      const result = await matcher.dispatch(message, tenantId, { history });
      return {
        tenant_id: tenantId,
        agent_id: result.agentId,
        response: result.response,
        tokens_used: result.tokens,
        thread_id: thread_id || `thread-${Date.now()}`,
      };
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Agent dispatch failed',
        details: err.message,
      });
    }
  });
};
