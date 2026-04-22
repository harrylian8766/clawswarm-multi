/**
 * OpenClaw Client SDK
 * Phase 0 PoC: 直接使用 OpenClaw Session API
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';

export interface OpenClawAgent {
  id: string;
  name: string;
  description?: string;
}

export interface SendMessageOptions {
  agentId: string;
  message: string;
  threadId?: string;
  context?: Record<string, any>;
  onChunk?: (chunk: string) => void;
}

export interface SendMessageResult {
  taskId: string;
  response: string;
  status: 'done' | 'failed';
}

/**
 * 列出 OpenClaw Gateway 上的所有 Agent
 */
export async function listAgents(): Promise<OpenClawAgent[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/agents`);
    if (!res.ok) return [];
    const data = await res.json() as { agents?: OpenClawAgent[] };
    return data.agents || [];
  } catch {
    return [];
  }
}

/**
 * 向指定 Agent 发送消息
 * Phase 0 PoC: 使用 sessions_send 协议
 */
export async function sendMessage(opts: SendMessageOptions): Promise<SendMessageResult> {
  const { agentId, message, threadId, context } = opts;

  // Phase 0 PoC: 调用 OpenClaw Gateway 的 session API
  // 实际需要通过 OpenClaw 的 sessions API 发送消息
  const response = await fetch(`${GATEWAY_URL}/api/sessions/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      message,
      thread_id: threadId,
      context,
    }),
  });

  if (!response.ok) {
    return {
      taskId: `error-${Date.now()}`,
      response: '',
      status: 'failed',
    };
  }

  const data = await response.json() as { task_id?: string; response?: string; status?: string };
  return {
    taskId: data.task_id || `task-${Date.now()}`,
    response: data.response || '',
    status: (data.status === 'failed' ? 'failed' : 'done') as 'done' | 'failed',
  };
}

/**
 * 获取 Agent 回复状态
 */
export async function getReply(taskId: string): Promise<{ status: string; response?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/sessions/reply/${taskId}`);
    if (!res.ok) return { status: 'unknown' };
    return await res.json() as { status: string; response?: string };
  } catch {
    return { status: 'error' };
  }
}

/**
 * 注册 OpenClaw 实例到 ClawSwarm-Multi
 */
export async function registerInstance(instanceInfo: {
  name: string;
  endpoint: string;
  capabilities: string[];
  tools: string[];
  supported_models: string[];
  deployment_location?: string;
  memory_context?: string;
}) {
  // 这个函数由 ClawSwarm-Multi 服务端调用
  // 将实例注册到本地数据库（见 instances 路由）
  return instanceInfo;
}
