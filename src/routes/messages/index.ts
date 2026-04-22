/**
 * Messages 路由 - 核心消息路由
 * Phase 1: 支持 @mention、群组、线程、规则引擎
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CoordinatorMatcher } from '../../coordinator/matcher';
import { checkDialogueRules, DialogueContext } from '../../coordinator/rules-engine';

const matcher = new CoordinatorMatcher();

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/messages - 发送消息
  app.post('/messages', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      message: string;
      group_id?: string;
      thread_id?: string;
      sender_type?: string;
      sender_id?: string;
      idempotency_key?: string;
    };

    if (!body.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    // 幂等性检查
    if (body.idempotency_key) {
      const existing = await app.db('chat_messages')
        .where({ tenant_id: tenantId, idempotency_key: body.idempotency_key })
        .first();
      if (existing) return { message: existing, cached: true };
    }

    const senderType = body.sender_type || 'human';
    const senderId = body.sender_id || 'anonymous';

    // 解析 @mention
    const mentions = body.message.match(/@(\w[\w-]*)/g) || [];
    const mentionedMembers = mentions.map((m) => m.slice(1));

    // 规则检查（仅 agent 发送的消息需要检查）
    if (senderType === 'agent') {
      const recentCount = await app.db('chat_messages')
        .where({ tenant_id: tenantId, thread_id: body.thread_id })
        .count('* as cnt')
        .first();

      const ruleCheck = checkDialogueRules(body.message, {
        threadId: body.thread_id,
        senderId,
        recentTurns: Number(recentCount?.cnt || 0),
        mentionedMembers,
      });

      if (ruleCheck.blocked) {
        return reply.status(422).send({ error: ruleCheck.reason, blocked: true });
      }
    }

    // 存储消息
    const [msg] = await app.db('chat_messages').insert({
      tenant_id: tenantId,
      group_id: body.group_id,
      thread_id: body.thread_id,
      sender_type: senderType,
      sender_id: senderId,
      content: body.message,
      idempotency_key: body.idempotency_key,
      mentioned_members: JSON.stringify(mentionedMembers),
    }).returning('*');

    // 分发到 Agent
    try {
      const result = await matcher.dispatch(body.message, tenantId, {
        history: [{
          role: 'user' as const,
          content: `[Group: ${body.group_id || 'default'}] ${body.message}`,
        }],
      });

      // 存储 Agent 回复
      const [agentMsg] = await app.db('chat_messages').insert({
        tenant_id: tenantId,
        group_id: body.group_id,
        thread_id: body.thread_id,
        sender_type: 'agent',
        sender_id: result.agentId,
        content: result.response,
      }).returning('*');

      return {
        message: msg,
        agent_reply: agentMsg,
        agent_id: result.agentId,
        tokens_used: result.tokens,
      };
    } catch (err: any) {
      return {
        message: msg,
        agent_error: err.message,
      };
    }
  });

  // GET /api/v1/messages?group_id=xxx&thread_id=yyy - 查询消息
  app.get('/messages', async (request) => {
    const tenantId = (request as any).tenantId;
    const { group_id, thread_id, limit, before } = request.query as {
      group_id?: string;
      thread_id?: string;
      limit?: string;
      before?: string;
    };

    let query = app.db('chat_messages').where({ tenant_id: tenantId });
    if (group_id) query = query.where({ group_id });
    if (thread_id) query = query.where({ thread_id });
    if (before) query = query.where('created_at', '<', before);

    const messages = await query
      .orderBy('created_at', 'desc')
      .limit(Number(limit) || 50)
      .select('*');

    return {
      messages: messages.map((m) => ({
        ...m,
        mentioned_members: typeof m.mentioned_members === 'string' ? JSON.parse(m.mentioned_members) : m.mentioned_members,
      })).reverse(),
    };
  });
};
