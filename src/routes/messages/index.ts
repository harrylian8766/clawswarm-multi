/**
 * Messages 路由 - 核心消息路由
 * Phase 3: 智能调度 + Capability 匹配
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SmartCoordinator } from '../../coordinator/smart-coordinator';
import { checkDialogueRules } from '../../coordinator/rules-engine';

const coordinator = new SmartCoordinator();

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/messages - 发送消息（智能路由）
  app.post('/messages', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      message: string;
      group_id?: string;
      thread_id?: string;
      sender_type?: string;
      sender_id?: string;
      idempotency_key?: string;
      preferred_agent_id?: string;
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

    // 规则检查（仅 agent 发送的消息）
    if (senderType === 'agent') {
      const recentCount = await app.db('chat_messages')
        .where({ tenant_id: tenantId, thread_id: body.thread_id })
        .count('* as cnt').first();

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

    // 存储用户消息
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

    // 获取租户下所有活跃 Agent
    const agentRows = await app.db('agent_instances')
      .where({ tenant_id: tenantId, status: 'active' })
      .select('*');

    const agents = agentRows.map((a) => ({
      id: a.id,
      name: a.name,
      openclaw_instance_id: a.openclaw_instance_id,
      capabilities: typeof a.capabilities === 'string' ? JSON.parse(a.capabilities) : a.capabilities,
      tools: typeof a.tools === 'string' ? JSON.parse(a.tools) : a.tools,
      status: a.status,
      last_heartbeat: a.last_heartbeat,
    }));

    // 检测超时 Agent
    const timedOut = coordinator.detectTimeouts(agents);
    if (timedOut.length > 0) {
      for (const t of timedOut) {
        await app.db('agent_instances').where({ id: t.id }).update({ status: 'draining' });
      }
    }

    // 智能路由 + 执行
    try {
      const result = await coordinator.dispatch(body.message, agents, {
        preferredAgentId: body.preferred_agent_id,
      });

      // 存储 Agent 回复
      const [agentMsg] = await app.db('chat_messages').insert({
        tenant_id: tenantId,
        group_id: body.group_id,
        thread_id: body.thread_id,
        sender_type: 'agent',
        sender_id: result.match.agentId,
        content: result.response,
        convergence_signal: null,
      }).returning('*');

      return {
        message: msg,
        agent_reply: agentMsg,
        routing: {
          agent_id: result.match.agentId,
          agent_name: result.match.agentName,
          reason: result.match.reason,
          confidence: result.match.confidence,
          matched_capabilities: result.match.matchedCapabilities,
        },
        tokens_used: result.tokens,
      };
    } catch (err: any) {
      return {
        message: msg,
        agent_error: err.message,
      };
    }
  });

  // GET /api/v1/messages?group_id=xxx&thread_id=yyy
  app.get('/messages', async (request) => {
    const tenantId = (request as any).tenantId;
    const { group_id, thread_id, limit, before } = request.query as {
      group_id?: string; thread_id?: string; limit?: string; before?: string;
    };

    let query = app.db('chat_messages').where({ tenant_id: tenantId });
    if (group_id) query = query.where({ group_id });
    if (thread_id) query = query.where({ thread_id });
    if (before) query = query.where('created_at', '<', before);

    const messages = await query.orderBy('created_at', 'desc').limit(Number(limit) || 50).select('*');
    return {
      messages: messages.map((m) => ({
        ...m,
        mentioned_members: typeof m.mentioned_members === 'string' ? JSON.parse(m.mentioned_members) : m.mentioned_members,
      })).reverse(),
    };
  });
};
